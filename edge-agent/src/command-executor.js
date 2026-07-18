import { logger } from './logger.js';

/**
 * Executes a backend-issued DeviceCommand locally and returns an ack result.
 *
 * Types (see DeviceCommandType):
 *   PRINT              → render + send to the wired printer
 *   ENROLL_FINGERPRINT → invoke fingerprint SDK (stubbed; vendor SDK on-site)
 *   ENROLL_FACE        → invoke face SDK (stubbed)
 *   ENROLL_CARD        → capture next RFID/smart-card tap (stubbed)
 *   DELETE_USER        → remove local template (stubbed)
 *   SYNC_USERS         → pull roster into local devices (stubbed)
 *   OPEN_GATE          → pulse relay / barrier (stubbed)
 *   REBOOT             → restart the target device (stubbed)
 *
 * Stubs return a simulated success so the full command loop (issue → poll →
 * execute → ack) is exercisable now; each maps to a concrete vendor SDK call
 * when deployed against real hardware.
 */
export class CommandExecutor {
  constructor({ printer }) {
    this.printer = printer;
  }

  async execute(command) {
    const { id, type, payload } = command;
    logger.info('executing command', { id, type });
    try {
      const result = await this.#dispatch(type, payload || {});
      return { status: 'ACKED', result };
    } catch (err) {
      logger.warn('command failed', { id, type, error: err.message });
      return { status: 'FAILED', result: { error: err.message } };
    }
  }

  async #dispatch(type, payload) {
    switch (type) {
      case 'PRINT': {
        const res = await this.printer.print(payload);
        return { printed: true, ...res };
      }
      case 'ENROLL_FINGERPRINT':
      case 'ENROLL_FACE':
      case 'ENROLL_CARD':
        return {
          enrolled: true,
          modality: type.replace('ENROLL_', '').toLowerCase(),
          userId: payload.userId ?? null,
          simulated: true,
        };
      case 'DELETE_USER':
        return { deleted: true, userId: payload.userId ?? null, simulated: true };
      case 'SYNC_USERS':
        return { synced: true, count: Array.isArray(payload.users) ? payload.users.length : 0 };
      case 'OPEN_GATE':
        return { opened: true, gateId: payload.gateId ?? null, simulated: true };
      case 'REBOOT':
        return { rebooting: true, simulated: true };
      default:
        throw new Error(`Unsupported command type: ${type}`);
    }
  }
}
