import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
} from '@pssms/shared';
import { DocumentsService } from '../application/documents.service';
import {
  DocumentDownloadUrlResponseDto,
  DocumentObjectResponseDto,
  ListDocumentsQueryDto,
} from './dto/documents.dto';

type MultipartValue = { type: 'field'; value: unknown };
type MultipartFilePart = {
  type: 'file';
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
};

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload document to MinIO and store metadata',
    description:
      'Multipart: file + resourceType + resourceId. Max 5MB; pdf/png/jpeg/webp. Staff: documents.manage plus parent domain permission. Supplier portal may upload on own Supplier / SupplierSubmission. Customer portal cannot upload.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'resourceType', 'resourceId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        resourceType: {
          type: 'string',
          example: 'VisitorAppointment',
          enum: [
            'OccurrenceEntry',
            'PettyCashVoucher',
            'Customer',
            'Contract',
            'VisitorAppointment',
            'ParkingViolation',
            'Supplier',
            'SupplierSubmission',
            'Incident',
            'Employee',
            'JobApplication',
          ],
        },
        resourceId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiCreatedResponse({ type: DocumentObjectResponseDto })
  async upload(
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<DocumentObjectResponseDto> {
    const partsFn = (
      req as FastifyRequest & {
        parts?: () => AsyncIterableIterator<
          | (MultipartFilePart & { fieldname?: string })
          | (MultipartValue & { fieldname?: string; value: unknown })
        >;
      }
    ).parts;
    if (typeof partsFn !== 'function') {
      throw new BadRequestException(
        'Multipart not enabled — restart core-api after @fastify/multipart register',
      );
    }

    let resourceType: string | undefined;
    let resourceId: string | undefined;
    let fileName = 'file';
    let contentType = 'application/octet-stream';
    let buffer: Buffer | undefined;

    try {
      for await (const part of partsFn.call(req)) {
        if (part.type === 'file') {
          fileName = part.filename || 'file';
          contentType = part.mimetype || 'application/octet-stream';
          buffer = await part.toBuffer();
        } else if (part.type === 'field') {
          const name = (part as { fieldname?: string }).fieldname;
          const value =
            typeof part.value === 'string'
              ? part.value
              : part.value != null
                ? String(part.value)
                : undefined;
          if (name === 'resourceType') resourceType = value;
          if (name === 'resourceId') resourceId = value;
        }
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new BadRequestException(
          'File exceeds maximum size of 5MB (pdf, png, jpeg, or webp)',
        );
      }
      throw err;
    }

    if (!buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!resourceType || !resourceId) {
      throw new BadRequestException(
        'resourceType and resourceId form fields are required',
      );
    }

    return this.service.upload({
      fileName,
      contentType,
      buffer,
      resourceType,
      resourceId,
      user,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'List document metadata for a resource',
    description:
      'Staff: documents.manage + parent permission. Customer portal: read-only on own Customer, Contract, or VisitorAppointment (same customerId) resourceId.',
  })
  @ApiOkResponse({ type: [DocumentObjectResponseDto] })
  list(
    @Query() query: ListDocumentsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.list(user, query.resourceType, query.resourceId);
  }

  @Get(':id/download-url')
  @ApiOperation({
    summary: 'Short-lived presigned GET URL for object',
    description:
      'Same ownership + authz as list (portal: own Customer / Contract / VisitorAppointment attachments).',
  })
  @ApiOkResponse({ type: DocumentDownloadUrlResponseDto })
  downloadUrl(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.downloadUrl(id, user);
  }

  private fieldString(
    fields: Record<string, MultipartValue | MultipartValue[]>,
    key: string,
  ): string | undefined {
    const raw = fields[key];
    const one = Array.isArray(raw) ? raw[0] : raw;
    if (!one || one.type !== 'field') return undefined;
    const v = one.value;
    return typeof v === 'string' ? v : v != null ? String(v) : undefined;
  }
}
