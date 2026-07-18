#!/usr/bin/env node
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { ApiClient } from './api-client.js';
import { EventQueue } from './queue.js';
import { createPrinter } from './printers/index.js';
import { CommandExecutor } from './command-executor.js';
import { EdgeAgent } from './agent.js';
import { HidScanner } from './devices/hid-scanner.js';

async function main() {
  const config = loadConfig();
  const api = new ApiClient({
    apiUrl: config.apiUrl,
    gatewayKey: config.gatewayKey,
    deviceKey: config.deviceKey,
  });
  const queue = new EventQueue(config.queueFile);
  const printer = createPrinter(config.printer, { forceNoop: config.simulate });
  const executor = new CommandExecutor({ printer });
  const agent = new EdgeAgent({ config, api, queue, executor });

  await agent.start();

  if (config.hid.enabled && !config.simulate) {
    const scanner = new HidScanner({
      vendorId: config.hid.vendorId,
      productId: config.hid.productId,
      path: config.hid.path,
      deviceCode: config.hid.deviceCode,
      eventType: config.hid.eventType,
    });
    scanner.on('scan', (value) => {
      agent.capture({
        type: config.hid.eventType,
        deviceCode: config.hid.deviceCode,
        payload: { value, source: 'usb-hid' },
      });
    });
    scanner.on('error', (err) => logger.error('scanner error', { error: err.message }));
    try {
      await scanner.start();
    } catch (err) {
      logger.error('failed to start HID scanner', { error: err.message });
    }
  }

  if (config.simulate) {
    logger.info('simulator mode: emitting a synthetic scan every 10s');
    setInterval(() => {
      const value = `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      agent.capture({
        type: config.hid.eventType,
        deviceCode: config.hid.deviceCode,
        payload: { value, source: 'simulator' },
      });
    }, 10000);
  }

  const shutdown = () => {
    agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('fatal', { error: err.message });
  process.exit(1);
});
