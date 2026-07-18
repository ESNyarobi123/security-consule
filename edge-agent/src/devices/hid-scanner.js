import { EventEmitter } from 'node:events';
import { logger } from '../logger.js';
import { decodeReport } from './hid-scancodes.js';

/**
 * Reads a USB HID scanner (barcode / QR / RFID / smart-card reader) via the
 * optional `node-hid` dependency and emits complete scans.
 *
 * IMPORTANT: the device must be configured in "HID data / HID POS" mode. In the
 * default "HID keyboard" mode the OS claims the device and node-hid cannot open
 * it (a security precaution against keyloggers). If your reader only supports
 * serial/UART mode, bridge it with node-serialport instead.
 *
 * Emits: 'scan' (decoded string), 'error' (Error), 'open', 'close'.
 */
export class HidScanner extends EventEmitter {
  constructor({ vendorId, productId, path, deviceCode, eventType, terminator = '\n' }) {
    super();
    this.vendorId = vendorId;
    this.productId = productId;
    this.path = path;
    this.deviceCode = deviceCode;
    this.eventType = eventType;
    this.terminator = terminator;
    this.buffer = '';
    this.device = null;
  }

  async start() {
    let HID;
    try {
      HID = await import('node-hid');
    } catch {
      throw new Error(
        "USB scanning requires the optional 'node-hid' package (npm i node-hid), " +
          'or run with EDGE_SIMULATE=true.',
      );
    }
    const NodeHid = HID.default ?? HID;
    try {
      this.device = this.path
        ? new NodeHid.HID(this.path)
        : new NodeHid.HID(this.vendorId, this.productId);
    } catch (err) {
      throw new Error(
        `Cannot open HID device (vid=${this.vendorId} pid=${this.productId}): ${err.message}. ` +
          'Ensure it is in HID-data mode and not claimed as a keyboard.',
      );
    }

    this.device.on('data', (data) => this.#onData(data));
    this.device.on('error', (err) => this.emit('error', err));
    logger.info('HID scanner opened', { deviceCode: this.deviceCode });
    this.emit('open');
  }

  #onData(report) {
    const { char, enter } = decodeReport(report);
    if (enter || (char && char === this.terminator)) {
      this.#flush();
      return;
    }
    if (char) this.buffer += char;
  }

  #flush() {
    const value = this.buffer.trim();
    this.buffer = '';
    if (value) this.emit('scan', value);
  }

  stop() {
    try {
      this.device?.close();
    } catch {
      /* ignore */
    }
    this.emit('close');
  }
}
