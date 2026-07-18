import * as Crypto from 'expo-crypto';

export function newClientEventId(): string {
  return Crypto.randomUUID();
}
