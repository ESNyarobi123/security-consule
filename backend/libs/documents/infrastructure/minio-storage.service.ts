import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private client!: S3Client;
  private presignClient!: S3Client;
  private bucket!: string;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const endpointHost =
      this.config.get<string>('MINIO_ENDPOINT')?.trim() || 'localhost';
    const port = Number(this.config.get<string>('MINIO_PORT') ?? 9000);
    const useSsl =
      (this.config.get<string>('MINIO_USE_SSL') ?? 'false').toLowerCase() ===
      'true';
    const accessKey =
      this.config.get<string>('MINIO_ROOT_USER')?.trim() || 'pssms';
    const secretKey =
      this.config.get<string>('MINIO_ROOT_PASSWORD')?.trim() ||
      'pssms_minio_password';
    this.bucket =
      this.config.get<string>('MINIO_BUCKET_DOCUMENTS')?.trim() ||
      'pssms-documents';

    const protocol = useSsl ? 'https' : 'http';
    const endpoint = `${protocol}://${endpointHost}:${port}`;

    const credentials = { accessKeyId: accessKey, secretAccessKey: secretKey };
    const base = {
      region: this.config.get<string>('MINIO_REGION')?.trim() || 'us-east-1',
      credentials,
      forcePathStyle: true,
    };

    this.client = new S3Client({ ...base, endpoint });

    // Presigned URLs must be reachable from the browser (host map 9010→9000).
    const publicHost =
      this.config.get<string>('MINIO_PUBLIC_ENDPOINT')?.trim() || endpointHost;
    const publicPort = Number(
      this.config.get<string>('MINIO_PUBLIC_PORT') ?? port,
    );
    const publicEndpoint = `${protocol}://${publicHost}:${publicPort}`;
    this.presignClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({ ...base, endpoint: publicEndpoint });

    try {
      await this.ensureBucket();
      this.ready = true;
      this.logger.log(
        `MinIO ready bucket=${this.bucket} endpoint=${endpoint} public=${publicEndpoint}`,
      );
    } catch (err) {
      this.ready = false;
      this.logger.error(
        `MinIO init failed (uploads will 503): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  getBucket(): string {
    return this.bucket;
  }

  assertReady(): void {
    if (!this.ready) {
      throw new ServiceUnavailableException(
        'Object storage (MinIO) is not available',
      );
    }
  }

  async putObject(params: {
    objectKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    this.assertReady();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  async presignGet(
    objectKey: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    this.assertReady();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.presignClient, command, {
      expiresIn: expiresInSeconds,
    });
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      // create if missing
    }
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    this.logger.log(`Created MinIO bucket ${this.bucket}`);
  }
}
