# PSSMS Edge Agent

A small Node.js agent that runs **on-site** (a gate PC, mini-PC, or Raspberry Pi)
and bridges local USB / network devices to the HIGHLINK PSSMS cloud
device-integration API.

It exists because many devices **cannot** push to the cloud themselves:

- **USB fingerprint / QR / barcode / RFID / smart-card readers** — no network stack,
  speak USB HID.
- **Thermal / receipt printers** — accept jobs over raw TCP 9100 (ESC/POS) or IPP,
  but need something to *send* the job.

Network biometric terminals (e.g. ZKTeco) that speak the iClock/ADMS protocol do
**not** need this agent — they push directly and are handled by the
`integration-gateway`.

## What it does

```text
USB HID reader ──▶ node-hid ─┐
                             ├─▶ durable queue ─▶ POST /device-api/events
simulator (no hw) ───────────┘

/device-api/commands ─poll─▶ CommandExecutor ─▶ ESC/POS or IPP printer ─▶ ack
                                              └▶ enroll / open-gate / sync (SDK hooks)

heartbeat ─▶ keeps the gateway/device ONLINE in the console
```

- **At-least-once delivery** — events are persisted to `data/queue.jsonl` the moment
  they are captured and only removed after the backend confirms ingestion. The
  backend deduplicates on `dedupeKey`, so retries are safe.
- **Command loop** — polls pending commands, executes them locally (print now;
  enroll/open-gate/sync/reboot are SDK hook points), and acknowledges the result.

## Auth model

Set **one** credential (issued from the console when you register the gateway/device):

| Credential          | Header          | Use for                                        |
| ------------------- | --------------- | ---------------------------------------------- |
| `EDGE_GATEWAY_KEY`  | `X-Gateway-Key` | A site hub forwarding **multiple** USB devices |
| `EDGE_DEVICE_KEY`   | `X-Device-Key`  | A **single** self-pushing terminal             |

When running as a gateway, every event carries a `deviceCode` so the backend can
resolve (and authorize) the owning device.

## Quick start

```bash
cp .env.example .env      # fill EDGE_API_URL + EDGE_GATEWAY_KEY

# 1) Simulator — no hardware, proves the full pipeline end-to-end
npm run simulate

# 2) Real USB reader (must be in HID-data / HID-POS mode, NOT keyboard mode)
npm i node-hid            # optional native dep, installed only when needed
EDGE_HID_ENABLED=true EDGE_HID_VENDOR_ID=0x1234 EDGE_HID_PRODUCT_ID=0x5678 npm start
```

> **HID note:** a reader left in the default *HID keyboard* mode is claimed by the
> OS and cannot be opened (an anti-keylogger precaution). Scan the vendor's
> "HID data mode" configuration barcode first. Serial/UART-only readers should be
> bridged with `node-serialport` instead.

## Printing

- `EDGE_PRINTER_TYPE=escpos` → raw TCP **9100** (AppSocket/JetDirect) — driverless,
  fastest path for thermal printers.
- `EDGE_PRINTER_TYPE=ipp` → IPP on port **631** (`npm i ipp`) — for office printers
  needing spooling / auth / encryption.
- `EDGE_PRINTER_TYPE=noop` → logs the rendered job (default / simulator).

## Testing

`test/transport-e2e.mjs` registers a gateway + device against a **live core-api**,
then exercises the agent's real transport: heartbeat → push event → dedupe →
issue PRINT command → poll → execute (noop printer) → ack.

```bash
E2E_ADMIN_EMAIL=admin@highlink.co.tz E2E_ADMIN_PASSWORD=... \
E2E_API_URL=http://localhost:4001/api/v1 \
npm run test:transport
```
