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
  RequirePermissions,
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
@RequirePermissions('documents.manage')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload document to MinIO and store metadata',
    description:
      'Multipart: file + resourceType + resourceId. Max 10MB; pdf/png/jpeg/webp. Requires documents.manage plus parent domain permission (OccurrenceEntry → operations.manage, PettyCashVoucher → finance.manage) and org ownership of the parent resource.',
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
          example: 'OccurrenceEntry',
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
    const fileFn = (
      req as FastifyRequest & {
        file?: () => Promise<
          | (MultipartFilePart & {
              fields?: Record<string, MultipartValue | MultipartValue[]>;
            })
          | undefined
        >;
      }
    ).file;
    if (typeof fileFn !== 'function') {
      throw new BadRequestException(
        'Multipart not enabled — restart core-api after @fastify/multipart register',
      );
    }

    const part = await fileFn.call(req);
    if (!part) {
      throw new BadRequestException('file is required');
    }

    const fields = part.fields ?? {};
    const resourceType = this.fieldString(fields, 'resourceType');
    const resourceId = this.fieldString(fields, 'resourceId');
    if (!resourceType || !resourceId) {
      throw new BadRequestException(
        'resourceType and resourceId form fields are required',
      );
    }

    const buffer = await part.toBuffer();
    return this.service.upload({
      fileName: part.filename || 'file',
      contentType: part.mimetype || 'application/octet-stream',
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
      'Same ownership + parent-permission checks as upload (by resourceType/resourceId).',
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
      'Resolves the document’s resourceType/resourceId and applies the same ownership + parent-permission checks as upload.',
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
