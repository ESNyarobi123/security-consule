import { logger } from '../logger.js';
import { EscPosPrinter, buildReceipt } from './escpos.js';

/**
 * A no-op printer used in simulator/test mode and when no printer is wired.
 * It "prints" by logging the rendered job so command flows can be exercised
 * end-to-end without physical hardware.
 */
class NoopPrinter {
  constructor() {
    this.type = 'noop';
  }

  async print(job) {
    const bytes = Buffer.isBuffer(job) ? job.length : buildReceipt(job).length;
    logger.info('noop printer received job', { bytes });
    return { simulated: true, bytes };
  }
}

/**
 * IPP printer (port 631) for office/document printers that expect spooling,
 * authentication and encryption. Lazy-loads the optional `ipp` dependency so
 * the agent still runs when it is not installed.
 */
class IppPrinter {
  constructor({ ippUrl }) {
    this.ippUrl = ippUrl;
    this.type = 'ipp';
  }

  async print(job) {
    let ipp;
    try {
      ipp = (await import('ipp')).default;
    } catch {
      throw new Error("IPP printing requires the optional 'ipp' package (npm i ipp)");
    }
    const printer = ipp.Printer(this.ippUrl);
    const data = Buffer.isBuffer(job)
      ? job
      : Buffer.from(Array.isArray(job.lines) ? job.lines.join('\n') : String(job.text ?? ''), 'utf8');
    const msg = {
      'operation-attributes-tag': {
        'requesting-user-name': 'pssms-edge-agent',
        'document-format': job.documentFormat || 'application/octet-stream',
      },
      data,
    };
    return new Promise((resolve, reject) => {
      printer.execute('Print-Job', msg, (err, res) => {
        if (err) return reject(err);
        resolve({ ipp: true, statusCode: res?.statusCode, target: this.ippUrl });
      });
    });
  }
}

export function createPrinter(printerConfig, { forceNoop = false } = {}) {
  if (forceNoop) return new NoopPrinter();
  switch (printerConfig.type) {
    case 'escpos':
      return new EscPosPrinter({ host: printerConfig.host, port: printerConfig.port });
    case 'ipp':
      if (!printerConfig.ippUrl) {
        logger.warn('EDGE_PRINTER_IPP_URL not set; falling back to noop printer');
        return new NoopPrinter();
      }
      return new IppPrinter({ ippUrl: printerConfig.ippUrl });
    case 'noop':
    default:
      return new NoopPrinter();
  }
}
