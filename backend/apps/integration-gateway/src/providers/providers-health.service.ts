import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@pssms/shared';

export type AdapterHealth = {
  code: string;
  category: string;
  status: 'UP' | 'DOWN' | 'DISABLED';
  adapterClass: string;
  isEnabled: boolean;
  detail?: string;
};

/**
 * Real adapter health for Developer portal — console adapters are in-process;
 * vision-ai-anpr probes VISION_AI_URL/health (no fake UP when unreachable).
 * WhatsApp is always surfaced as DISABLED when not registered (honest).
 */
@Injectable()
export class ProvidersHealthService {
  private readonly logger = new Logger(ProvidersHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<{ checkedAt: string; adapters: AdapterHealth[] }> {
    const registered = await this.prisma.providerRegistry.findMany({
      orderBy: { code: 'asc' },
    });

    const rows =
      registered.length > 0
        ? registered
        : [
            {
              code: 'console-sms',
              category: 'SMS' as const,
              adapterClass: 'ConsoleSmsProvider',
              isEnabled: true,
            },
            {
              code: 'console-payment',
              category: 'PAYMENT' as const,
              adapterClass: 'ConsolePaymentProvider',
              isEnabled: true,
            },
            {
              code: 'vision-ai-anpr',
              category: 'ANPR' as const,
              adapterClass: 'VisionAiAnprAdapter',
              isEnabled: true,
            },
          ];

    const vision = await this.probeVisionAi();
    const adapters: AdapterHealth[] = rows.map((p) => {
      if (!p.isEnabled) {
        return {
          code: p.code,
          category: String(p.category),
          status: 'DISABLED',
          adapterClass: p.adapterClass,
          isEnabled: false,
        };
      }
      if (p.code === 'vision-ai-anpr' || String(p.category) === 'ANPR') {
        return {
          code: p.code,
          category: String(p.category),
          status: vision.ok ? 'UP' : 'DOWN',
          adapterClass: p.adapterClass,
          isEnabled: true,
          detail: vision.detail,
        };
      }
      if (
        p.code === 'whatsapp' ||
        p.code.startsWith('whatsapp') ||
        String(p.category) === 'WHATSAPP'
      ) {
        return {
          code: p.code,
          category: 'WHATSAPP',
          status: 'DISABLED',
          adapterClass: p.adapterClass,
          isEnabled: false,
          detail: 'not implemented',
        };
      }
      return {
        code: p.code,
        category: String(p.category),
        status: 'UP',
        adapterClass: p.adapterClass,
        isEnabled: true,
        detail: 'in-process console adapter',
      };
    });

    const hasWhatsApp = adapters.some(
      (a) => a.code === 'whatsapp' || a.category === 'WHATSAPP',
    );
    if (!hasWhatsApp) {
      adapters.push({
        code: 'whatsapp',
        category: 'WHATSAPP',
        status: 'DISABLED',
        adapterClass: 'WhatsAppAdapter',
        isEnabled: false,
        detail: 'not implemented',
      });
    }

    return { checkedAt: new Date().toISOString(), adapters };
  }

  private async probeVisionAi(): Promise<{ ok: boolean; detail: string }> {
    const base = process.env.VISION_AI_URL ?? 'http://localhost:8000';
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return { ok: false, detail: `${base}/health → HTTP ${res.status}` };
      }
      return { ok: true, detail: `${base}/health` };
    } catch (err) {
      this.logger.warn(`vision-ai health failed: ${String(err)}`);
      return { ok: false, detail: String(err) };
    }
  }
}
