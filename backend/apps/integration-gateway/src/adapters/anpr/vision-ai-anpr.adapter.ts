import { Injectable, Logger } from '@nestjs/common';

export interface AnprRecognizeInput {
  imageUrl?: string;
  cameraId?: string;
  siteId?: string;
  plateHint?: string;
}

export interface AnprRecognizeResult {
  plateNumber: string;
  confidence: number;
  cameraId?: string;
  snapshotUrl?: string;
}

@Injectable()
export class VisionAiAnprAdapter {
  private readonly logger = new Logger(VisionAiAnprAdapter.name);

  async recognize(input: AnprRecognizeInput): Promise<AnprRecognizeResult> {
    const baseUrl = process.env.VISION_AI_URL ?? 'http://localhost:8000';
    try {
      const res = await fetch(`${baseUrl}/v1/anpr/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: input.imageUrl,
          camera_id: input.cameraId,
          site_id: input.siteId,
          plate_hint: input.plateHint,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          plate_number: string;
          confidence: number;
          camera_id?: string;
          snapshot_url?: string;
        };
        return {
          plateNumber: data.plate_number,
          confidence: data.confidence,
          cameraId: data.camera_id,
          snapshotUrl: data.snapshot_url,
        };
      }
    } catch (err) {
      this.logger.warn(`vision-ai unavailable, using stub: ${String(err)}`);
    }

    if (input.plateHint) {
      return {
        plateNumber: input.plateHint.toUpperCase(),
        confidence: 0.85,
        cameraId: input.cameraId,
        snapshotUrl: input.imageUrl,
      };
    }
    if (input.cameraId === 'demo-cam-01') {
      return {
        plateNumber: 'T123ABC',
        confidence: 0.92,
        cameraId: input.cameraId,
        snapshotUrl: input.imageUrl,
      };
    }
    return {
      plateNumber: 'UNKNOWN',
      confidence: 0.1,
      cameraId: input.cameraId,
    };
  }
}
