import net from 'node:net';

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Minimal ESC/POS command builder. Covers the common receipt primitives used by
 * gate passes / visitor badges. Extend per printer profile as needed.
 */
export function buildReceipt(job = {}) {
  const chunks = [];
  const push = (...bytes) => chunks.push(Buffer.from(bytes));
  const text = (s) => chunks.push(Buffer.from(String(s), 'utf8'));

  push(ESC, 0x40); // initialize

  if (job.title) {
    push(ESC, 0x61, 0x01); // center
    push(ESC, 0x21, 0x30); // double width/height
    text(job.title);
    text('\n');
    push(ESC, 0x21, 0x00); // normal
    push(ESC, 0x61, 0x00); // left
  }

  const lines = Array.isArray(job.lines) ? job.lines : job.text ? [job.text] : [];
  for (const line of lines) {
    text(line);
    text('\n');
  }

  if (job.barcode) {
    const data = Buffer.from(String(job.barcode), 'ascii');
    push(GS, 0x68, 0x50); // barcode height
    push(GS, 0x6b, 0x49, data.length); // CODE128
    chunks.push(data);
    text('\n');
  }

  if (job.qr) {
    const data = Buffer.from(String(job.qr), 'utf8');
    const len = data.length + 3;
    push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x08); // module size
    push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30);
    chunks.push(data);
    push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // print QR
    text('\n');
  }

  text('\n\n\n');
  push(GS, 0x56, 0x42, 0x00); // partial cut

  return Buffer.concat(chunks);
}

/**
 * Send raw ESC/POS bytes over AppSocket/JetDirect (TCP 9100). This is the
 * industry-standard, driverless path for networked thermal printers.
 */
export class EscPosPrinter {
  constructor({ host, port = 9100, timeoutMs = 8000 }) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
    this.type = 'escpos';
  }

  print(job) {
    const payload = Buffer.isBuffer(job) ? job : buildReceipt(job);
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;
      const done = (err, value) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (err) reject(err);
        else resolve(value);
      };
      socket.setTimeout(this.timeoutMs);
      socket.once('timeout', () => done(new Error('printer connection timed out')));
      socket.once('error', (err) => done(err));
      socket.connect(this.port, this.host, () => {
        socket.write(payload, (err) => {
          if (err) return done(err);
          done(null, { bytes: payload.length, target: `${this.host}:${this.port}` });
        });
      });
    });
  }
}
