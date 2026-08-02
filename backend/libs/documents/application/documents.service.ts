import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService } from '@pssms/shared';
import { MinioStorageService } from '../infrastructure/minio-storage.service';
import {
  DocumentDownloadUrlResponseDto,
  DocumentObjectResponseDto,
} from '../presentation/dto/documents.dto';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);
const PRESIGN_TTL_SECONDS = 300;

/** documents.manage alone is not enough — caller needs the parent domain permission. */
const PARENT_PERMISSION_BY_RESOURCE: Record<string, string> = {
  OccurrenceEntry: 'operations.manage',
  PettyCashVoucher: 'finance.manage',
  Customer: 'customers.manage',
  Contract: 'contracts.manage',
};

const SUPPORTED_RESOURCE_TYPES = new Set(
  Object.keys(PARENT_PERMISSION_BY_RESOURCE),
);

type AccessMode = 'read' | 'write';

function assertParentPermission(resourceType: string, user: AuthUser): void {
  const required = PARENT_PERMISSION_BY_RESOURCE[resourceType];
  if (!required) {
    throw new BadRequestException(
      `Unsupported resourceType (allowed: ${[...SUPPORTED_RESOURCE_TYPES].join(', ')})`,
    );
  }
  if (user.roles.includes('SUPER_ADMIN')) return;
  if (!user.permissions.includes(required)) {
    throw new ForbiddenException(
      `Missing permission ${required} for ${resourceType} attachments`,
    );
  }
}

async function assertResourceOwned(
  prisma: PrismaService,
  resourceType: string,
  resourceId: string,
  organizationId: string,
): Promise<void> {
  if (resourceType === 'OccurrenceEntry') {
    const entry = await prisma.occurrenceEntry.findFirst({
      where: { id: resourceId, organizationId },
      select: { id: true },
    });
    if (!entry) {
      throw new BadRequestException(
        'OccurrenceEntry not found in your organization',
      );
    }
    return;
  }
  if (resourceType === 'PettyCashVoucher') {
    const voucher = await prisma.pettyCashVoucher.findFirst({
      where: { id: resourceId, organizationId },
      select: { id: true },
    });
    if (!voucher) {
      throw new BadRequestException(
        'PettyCashVoucher not found in your organization',
      );
    }
    return;
  }
  if (resourceType === 'Customer') {
    const customer = await prisma.customer.findFirst({
      where: { id: resourceId, organizationId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found in your organization');
    }
    return;
  }
  if (resourceType === 'Contract') {
    const contract = await prisma.contract.findFirst({
      where: { id: resourceId, organizationId },
      select: { id: true },
    });
    if (!contract) {
      throw new BadRequestException('Contract not found in your organization');
    }
  }
}

/**
 * Org ownership of the parent resource + authz:
 * - CUSTOMER_PORTAL (JWT customerId): read-only on own Customer + own Contract attachments
 * - Staff: documents.manage + parent domain permission (+ SUPER_ADMIN bypass)
 */
async function assertDocumentAccess(
  prisma: PrismaService,
  resourceType: string,
  resourceId: string,
  user: AuthUser,
  mode: AccessMode,
): Promise<void> {
  if (user.customerId) {
    if (mode === 'write') {
      throw new ForbiddenException({
        error: 'CUSTOMER_PORTAL_READ_ONLY',
        message: 'Customer portal users cannot upload documents',
      });
    }
    if (resourceType === 'Customer') {
      if (resourceId !== user.customerId) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          message: 'Customer portal can only access their own documents',
        });
      }
    } else if (resourceType === 'Contract') {
      const contract = await prisma.contract.findFirst({
        where: {
          id: resourceId,
          organizationId: user.organizationId,
          customerId: user.customerId,
        },
        select: { id: true },
      });
      if (!contract) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          message: 'Customer portal can only access own contract documents',
        });
      }
      return;
    } else {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Customer portal can only access their own documents',
      });
    }
    await assertResourceOwned(
      prisma,
      resourceType,
      resourceId,
      user.organizationId,
    );
    return;
  }

  if (
    !user.roles.includes('SUPER_ADMIN') &&
    !user.permissions.includes('documents.manage')
  ) {
    throw new ForbiddenException('Missing permission documents.manage');
  }

  assertParentPermission(resourceType, user);
  await assertResourceOwned(
    prisma,
    resourceType,
    resourceId,
    user.organizationId,
  );
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: MinioStorageService,
  ) {}

  async upload(params: {
    fileName: string;
    contentType: string;
    buffer: Buffer;
    resourceType: string;
    resourceId: string;
    user: AuthUser;
  }): Promise<DocumentObjectResponseDto> {
    const resourceType = params.resourceType.trim();
    const resourceId = params.resourceId.trim();
    if (!SUPPORTED_RESOURCE_TYPES.has(resourceType)) {
      throw new BadRequestException(
        `Unsupported resourceType (allowed: ${[...SUPPORTED_RESOURCE_TYPES].join(', ')})`,
      );
    }
    if (!resourceId) {
      throw new BadRequestException('resourceId is required');
    }

    const contentType = (params.contentType || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported content type (allowed: pdf, png, jpeg, webp)',
      );
    }

    const safeName = this.sanitizeFileName(params.fileName);
    const ext = this.extensionOf(safeName);
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException(
        'Unsupported file extension (allowed: .pdf .png .jpg .jpeg .webp)',
      );
    }

    if (!params.buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    if (params.buffer.length > MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_BYTES} bytes`,
      );
    }

    await assertDocumentAccess(
      this.prisma,
      resourceType,
      resourceId,
      params.user,
      'write',
    );

    const checksum = createHash('sha256').update(params.buffer).digest('hex');
    const objectKey = [
      params.user.organizationId,
      resourceType,
      resourceId,
      `${randomUUID()}${ext}`,
    ].join('/');

    const bucket = this.storage.getBucket();
    await this.storage.putObject({
      objectKey,
      body: params.buffer,
      contentType,
    });

    const row = await this.prisma.documentObject.create({
      data: {
        organizationId: params.user.organizationId,
        bucket,
        objectKey,
        fileName: safeName,
        contentType,
        sizeBytes: params.buffer.length,
        resourceType,
        resourceId,
        uploadedBy: params.user.id,
        checksum,
      },
    });

    await this.audit.record({
      organizationId: params.user.organizationId,
      actorId: params.user.id,
      action: 'document.uploaded',
      resourceType: 'DocumentObject',
      resourceId: row.id,
      after: {
        id: row.id,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        linkedResourceType: resourceType,
        linkedResourceId: resourceId,
        objectKey: row.objectKey,
      },
    });

    return this.toDto(row);
  }

  async list(
    user: AuthUser,
    resourceType: string,
    resourceId: string,
  ): Promise<DocumentObjectResponseDto[]> {
    if (!resourceType?.trim() || !resourceId?.trim()) {
      throw new BadRequestException('resourceType and resourceId are required');
    }
    const type = resourceType.trim();
    const id = resourceId.trim();
    if (!SUPPORTED_RESOURCE_TYPES.has(type)) {
      throw new BadRequestException(
        `Unsupported resourceType (allowed: ${[...SUPPORTED_RESOURCE_TYPES].join(', ')})`,
      );
    }

    await assertDocumentAccess(this.prisma, type, id, user, 'read');

    const rows = await this.prisma.documentObject.findMany({
      where: {
        organizationId: user.organizationId,
        resourceType: type,
        resourceId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  async downloadUrl(
    id: string,
    user: AuthUser,
  ): Promise<DocumentDownloadUrlResponseDto> {
    const row = await this.prisma.documentObject.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) throw new NotFoundException('Document not found');

    await assertDocumentAccess(
      this.prisma,
      row.resourceType,
      row.resourceId,
      user,
      'read',
    );

    const url = await this.storage.presignGet(
      row.objectKey,
      PRESIGN_TTL_SECONDS,
    );
    return {
      url,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
      fileName: row.fileName,
      contentType: row.contentType,
    };
  }

  private sanitizeFileName(name: string): string {
    const base = (name || 'file').split(/[/\\]/).pop() || 'file';
    const cleaned = base.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180);
    return cleaned || 'file';
  }

  private extensionOf(fileName: string): string {
    const i = fileName.lastIndexOf('.');
    if (i < 0) return '';
    return fileName.slice(i).toLowerCase();
  }

  private toDto(row: {
    id: string;
    organizationId: string;
    bucket: string;
    objectKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    resourceType: string;
    resourceId: string;
    uploadedBy: string;
    checksum: string | null;
    createdAt: Date;
  }): DocumentObjectResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      bucket: row.bucket,
      objectKey: row.objectKey,
      fileName: row.fileName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      uploadedBy: row.uploadedBy,
      checksum: row.checksum,
      createdAt: row.createdAt,
    };
  }
}
