import { newClientEventId } from '@/lib/uuid';
import { apiRequest } from '@/services/api';
import { getFieldGps } from '@/services/location';
import { resolveDemoSite } from '@/services/sites';

export type ParkingPatrolObservationType =
  | 'IRREGULARITY'
  | 'SECURITY_OBSERVATION'
  | 'ACCIDENT'
  | 'SUSPICIOUS_ACTIVITY'
  | 'DAMAGE'
  | 'ILLEGAL_PARKING'
  | 'ABANDONED_VEHICLE'
  | 'OTHER';

export type ParkingPatrolObservation = {
  id: string;
  siteId: string;
  parkingArea: string;
  observationType: string;
  plateNumber?: string | null;
  notes?: string | null;
  severity: string;
  inspectedAt: string;
  fieldAlertId?: string | null;
  siteCode?: string | null;
};

export type CreateParkingPatrolInput = {
  parkingArea: string;
  observationType: ParkingPatrolObservationType;
  plateNumber?: string;
  notes?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
};

/** Online-only Module 13-M record (offline outbox deferred). */
export async function submitParkingPatrolObservation(
  input: CreateParkingPatrolInput,
): Promise<ParkingPatrolObservation> {
  const site = await resolveDemoSite();
  const gps = await getFieldGps({ allowFallback: true }).catch(() => null);
  const clientEventId = newClientEventId();

  return apiRequest<ParkingPatrolObservation>(
    '/api/v1/parking/patrol-observations',
    {
      method: 'POST',
      body: {
        siteId: site.id,
        parkingArea: input.parkingArea.trim(),
        observationType: input.observationType,
        plateNumber: input.plateNumber?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        severity: input.severity,
        latitude: gps?.latitude,
        longitude: gps?.longitude,
        clientEventId,
      },
    },
  );
}

export async function listMyParkingPatrolObservations(): Promise<
  ParkingPatrolObservation[]
> {
  return apiRequest<ParkingPatrolObservation[]>(
    '/api/v1/parking/patrol-observations',
  );
}
