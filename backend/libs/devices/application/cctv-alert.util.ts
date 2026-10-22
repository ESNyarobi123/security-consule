/**
 * Portal 35.22 — normalize raw CCTV_EVENT payloads into a situational alert
 * that a control-room operator can act on. Vendors send wildly different keys
 * (`event_type` vs `eventType`, `snapshot_url` vs `snapshotUrl`, ...), so the
 * raw payload is preserved but every alert also carries a stable view:
 * detection, confidence, camera, site, zone, snapshot, and recommended action.
 *
 * Video never passes through Nest — only metadata + snapshot/bounding-box refs.
 */

export type CctvSiteLabel = { code: string; name: string };

export type CctvCameraView = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  vendor: string | null;
  model: string | null;
  siteId: string | null;
  gateId: string | null;
  zone: string | null;
  nvrChannel: string | null;
  lastSeenAt: string | null;
};

export type CctvIncidentLink = {
  id: string;
  incidentNumber: string;
  status: string;
  severity: string;
};

/**
 * Who acted on the alert (acknowledge = reviewed, or record incident) and when.
 * Read from the audit trail so the inbox can say "reviewed by Sam Supervisor"
 * instead of only showing a status code.
 */
export type CctvAlertReview = {
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  note: string | null;
  incidentByName: string | null;
  incidentAt: string | null;
};

export type CctvAlertView = {
  id: string;
  type: string;
  status: string;
  routedTo: string | null;
  error: string | null;
  capturedAt: string;
  receivedAt: string;
  processedAt: string | null;
  ageMinutes: number | null;
  open: boolean;
  /** Raw AI class from the payload (INTRUSION, LOITERING, LINE_CROSSING, ...). */
  detectionType: string;
  detectionLabel: string;
  detectionCategory: string;
  /** Vendor code exactly as it arrived (before alias/inference). */
  detectionCode: string | null;
  /** true when the vendor code was mapped by keyword inference, not an exact catalog hit. */
  detectionInferred: boolean;
  severity: string;
  severityRank: number;
  confidence: number | null;
  confidencePct: number | null;
  zone: string | null;
  camera: CctvCameraView | null;
  siteId: string | null;
  siteCode: string | null;
  siteName: string | null;
  plateNumber: string | null;
  objectClass: string | null;
  personCount: number | null;
  boundingBox: number[] | null;
  snapshotUrl: string | null;
  clipUrl: string | null;
  title: string;
  summary: string;
  recommendedAction: string;
  incident: CctvIncidentLink | null;
  review: CctvAlertReview;
  payload: Record<string, unknown>;
};

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 5,
  ALARM: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const CRITICAL_TYPES = new Set([
  'WEAPON',
  'WEAPON_DETECTED',
  'GUN',
  'KNIFE',
  'GUNSHOT',
  'FIRE',
  'FIRE_DETECTED',
  'SMOKE',
  'SMOKE_DETECTED',
  'GAS_LEAK',
  'GAS',
  'EXPLOSION',
  'PANIC',
  'PANIC_ALARM',
  'SOS',
  'SOS_ALERT',
  'TAMPER',
  'TAMPERING',
  'CAMERA_TAMPER',
  'VIDEO_TAMPER',
  'VIOLENCE',
  'FIGHT',
  'CROWD_PANIC',
  'PERIMETER_BREACH',
]);

const HIGH_TYPES = new Set([
  'INTRUSION',
  'INTRUDER',
  'INTRUSION_DETECTED',
  'UNAUTHORIZED_ACCESS',
  'TAILGATING',
  'LINE_CROSSING',
  'AREA_INTRUSION',
  'PERIMETER',
  'FACE_UNKNOWN',
  'UNKNOWN_FACE',
  'FACE_DETECTED',
  'FACE_MATCH',
  'STRANGER',
  'PERSON_DETECTED',
  'PERSON',
  'HUMAN',
  'PEOPLE',
  'BLACKLIST',
  'BLACKLISTED_VEHICLE',
  'LOITERING',
  'ABANDONED_OBJECT',
  'OBJECT_LEFT',
  'OBJECT_REMOVED',
  'THEFT',
  'SHOPLIFTING',
  'CROWD',
  'CROWD_DETECTION',
  'CROWD_GATHERING',
  'FALL',
  'FALL_DETECTION',
  'DOOR_FORCED',
  'FORCED_DOOR',
  'DOOR_HELD',
  'GATE_FORCED',
  'GLASS_BREAK',
  'SCREAM',
]);

const LOW_TYPES = new Set([
  'MOTION',
  'MOTION_DETECTED',
  'CAMERA_EVENT',
  'CAMERA_OFFLINE',
  'VIDEO_LOSS',
  'SIGNAL_LOSS',
  'BLURRY',
  'ANPR',
  'ANPR_RESULT',
  'PLATE',
  'VEHICLE',
  'VEHICLE_DETECTED',
  'CAR',
  'TRUCK',
  'BUS',
  'MOTORCYCLE',
  'OBJECT',
  'OBJECT_DETECTION',
  'AUDIO',
  'SOUND_DETECTED',
]);

/** Severity for canonical types that are neither high nor critical nor low. */
const SEVERITY_BY_TYPE: Record<string, string> = {
  PARKING_VIOLATION: 'MEDIUM',
  ILLEGAL_PARKING: 'MEDIUM',
  OVERSTAY: 'MEDIUM',
  WRONG_ZONE: 'MEDIUM',
  NO_PERMIT: 'MEDIUM',
  VEHICLE_OVERSTAY: 'MEDIUM',
};

const CATEGORY_BY_TYPE: Record<string, string> = {
  INTRUSION: 'Perimeter / intrusion',
  INTRUDER: 'Perimeter / intrusion',
  INTRUSION_DETECTED: 'Perimeter / intrusion',
  UNAUTHORIZED_ACCESS: 'Perimeter / intrusion',
  PERIMETER: 'Perimeter / intrusion',
  PERIMETER_BREACH: 'Perimeter / intrusion',
  LINE_CROSSING: 'Perimeter / intrusion',
  AREA_INTRUSION: 'Perimeter / intrusion',
  PERSON_DETECTED: 'Person / presence',
  PERSON: 'Person / presence',
  HUMAN: 'Person / presence',
  PEOPLE: 'Person / presence',
  TAILGATING: 'Access / tailgating',
  FACE_UNKNOWN: 'Access / identity',
  UNKNOWN_FACE: 'Access / identity',
  FACE_DETECTED: 'Access / identity',
  FACE_MATCH: 'Access / identity',
  STRANGER: 'Access / identity',
  BLACKLIST: 'Access / identity',
  DOOR_FORCED: 'Access / door',
  FORCED_DOOR: 'Access / door',
  DOOR_HELD: 'Access / door',
  GATE_FORCED: 'Access / door',
  LOITERING: 'Behaviour / loitering',
  ABANDONED_OBJECT: 'Behaviour / object',
  OBJECT_LEFT: 'Behaviour / object',
  OBJECT_REMOVED: 'Behaviour / object',
  THEFT: 'Behaviour / object',
  SHOPLIFTING: 'Behaviour / object',
  CROWD: 'Crowd / occupancy',
  CROWD_DETECTION: 'Crowd / occupancy',
  CROWD_GATHERING: 'Crowd / occupancy',
  FALL: 'Safety / fall',
  FALL_DETECTION: 'Safety / fall',
  WEAPON: 'Safety / weapon',
  WEAPON_DETECTED: 'Safety / weapon',
  GUN: 'Safety / weapon',
  KNIFE: 'Safety / weapon',
  GUNSHOT: 'Safety / weapon',
  FIRE: 'Safety / fire',
  FIRE_DETECTED: 'Safety / fire',
  SMOKE: 'Safety / fire',
  SMOKE_DETECTED: 'Safety / fire',
  GAS_LEAK: 'Safety / hazard',
  GAS: 'Safety / hazard',
  EXPLOSION: 'Safety / hazard',
  VIOLENCE: 'Safety / violence',
  FIGHT: 'Safety / violence',
  CROWD_PANIC: 'Safety / violence',
  GLASS_BREAK: 'Safety / audio',
  SCREAM: 'Safety / audio',
  AUDIO: 'Safety / audio',
  SOUND_DETECTED: 'Safety / audio',
  TAMPER: 'Device / tamper',
  TAMPERING: 'Device / tamper',
  CAMERA_TAMPER: 'Device / tamper',
  VIDEO_TAMPER: 'Device / tamper',
  CAMERA_OFFLINE: 'Device / health',
  VIDEO_LOSS: 'Device / health',
  SIGNAL_LOSS: 'Device / health',
  BLURRY: 'Device / health',
  ANPR: 'Vehicle / ANPR',
  ANPR_RESULT: 'Vehicle / ANPR',
  PLATE: 'Vehicle / ANPR',
  VEHICLE: 'Vehicle / ANPR',
  VEHICLE_DETECTED: 'Vehicle / ANPR',
  CAR: 'Vehicle / ANPR',
  TRUCK: 'Vehicle / ANPR',
  BUS: 'Vehicle / ANPR',
  MOTORCYCLE: 'Vehicle / ANPR',
  BLACKLISTED_VEHICLE: 'Vehicle / ANPR',
  PARKING_VIOLATION: 'Parking / violation',
  ILLEGAL_PARKING: 'Parking / violation',
  OVERSTAY: 'Parking / violation',
  VEHICLE_OVERSTAY: 'Parking / violation',
  WRONG_ZONE: 'Parking / violation',
  NO_PERMIT: 'Parking / violation',
  MOTION: 'Camera / motion',
  MOTION_DETECTED: 'Camera / motion',
  CAMERA_EVENT: 'Camera / motion',
};

const ACTION_BY_CATEGORY: Record<string, string> = {
  'Perimeter / intrusion':
    'Open the live view, challenge the person, alert the on-site guard/supervisor and record an incident if the breach is real.',
  'Person / presence':
    'Check whether the person is expected in this zone at this time; challenge them, dispatch the nearest guard and record an incident if unauthorised.',
  'Access / tailgating':
    'Check the gate camera against visitor/employee access logs and confirm whether the entry was authorised.',
  'Access / identity':
    'Confirm identity against the access/visitor register; deny entry and record an incident if unknown.',
  'Access / door':
    'Check the door/gate contact and the live view, send a guard to verify, and record an incident if the opening was forced.',
  'Behaviour / loitering':
    'Keep the subject on screen, dispatch the nearest patrol and record an incident if the subject stays or acts suspiciously.',
  'Behaviour / object':
    'Inspect the object remotely, keep the area clear and send a guard to verify.',
  'Crowd / occupancy':
    'Check crowd density against site limits and notify the supervisor for crowd control.',
  'Safety / fall':
    'Dispatch first aid / emergency response and record an incident immediately.',
  'Safety / weapon':
    'Treat as CRITICAL — call emergency response, lock down the area and record an incident immediately.',
  'Safety / fire':
    'Treat as CRITICAL — trigger the fire alarm, call emergency response and record an incident.',
  'Safety / hazard':
    'Treat as CRITICAL — evacuate the affected zone and call emergency response.',
  'Safety / violence':
    'Treat as CRITICAL — alert the guard force, call emergency response and preserve the footage reference.',
  'Safety / audio':
    'Listen to the audio clip, check the nearest camera and dispatch a guard to confirm the source.',
  'Device / tamper':
    'Check camera health and physical access to the unit, then record an incident if the tamper is real.',
  'Device / health':
    'Check the camera power/network and the NVR channel; open a device fault if it does not come back online.',
  'Vehicle / ANPR':
    'Cross-check the plate against the parking permit / blacklist register and confirm the gate decision.',
  'Parking / violation':
    'Confirm the bay/permit rule on the parking register and raise or link the parking violation.',
  'Camera / motion':
    'Review the live view and acknowledge; escalate to an incident only if the movement is unauthorised.',
  'Generic motion':
    'Review the live view and acknowledge; escalate to an incident only if the movement is unauthorised.',
};

const LABELS: Record<string, string> = {
  INTRUSION: 'Intrusion',
  INTRUDER: 'Intruder',
  INTRUSION_DETECTED: 'Intrusion',
  UNAUTHORIZED_ACCESS: 'Unauthorised access',
  PERIMETER: 'Perimeter breach',
  PERIMETER_BREACH: 'Perimeter breach',
  LINE_CROSSING: 'Line crossing',
  AREA_INTRUSION: 'Area intrusion',
  PERSON_DETECTED: 'Person detected',
  PERSON: 'Person detected',
  HUMAN: 'Person detected',
  PEOPLE: 'People detected',
  TAILGATING: 'Tailgating',
  LOITERING: 'Loitering',
  ABANDONED_OBJECT: 'Abandoned object',
  OBJECT_LEFT: 'Object left behind',
  OBJECT_REMOVED: 'Object removed',
  THEFT: 'Possible theft',
  SHOPLIFTING: 'Possible shoplifting',
  CROWD: 'Crowd detected',
  CROWD_DETECTION: 'Crowd detected',
  CROWD_GATHERING: 'Crowd gathering',
  FALL: 'Fall detected',
  FALL_DETECTION: 'Fall detected',
  WEAPON: 'Weapon detected',
  WEAPON_DETECTED: 'Weapon detected',
  GUN: 'Firearm detected',
  KNIFE: 'Knife detected',
  GUNSHOT: 'Gunshot detected',
  FIRE: 'Fire detected',
  FIRE_DETECTED: 'Fire detected',
  SMOKE: 'Smoke detected',
  SMOKE_DETECTED: 'Smoke detected',
  GAS_LEAK: 'Gas leak',
  GAS: 'Gas detected',
  EXPLOSION: 'Explosion detected',
  VIOLENCE: 'Violence detected',
  FIGHT: 'Fight detected',
  CROWD_PANIC: 'Crowd panic',
  GLASS_BREAK: 'Glass break detected',
  SCREAM: 'Scream detected',
  AUDIO: 'Audio event',
  SOUND_DETECTED: 'Sound detected',
  TAMPER: 'Camera tamper',
  TAMPERING: 'Camera tamper',
  CAMERA_TAMPER: 'Camera tamper',
  VIDEO_TAMPER: 'Video tamper',
  CAMERA_OFFLINE: 'Camera offline',
  VIDEO_LOSS: 'Video signal lost',
  SIGNAL_LOSS: 'Video signal lost',
  BLURRY: 'Camera view blurred',
  DOOR_FORCED: 'Door forced open',
  FORCED_DOOR: 'Door forced open',
  DOOR_HELD: 'Door held open',
  GATE_FORCED: 'Gate forced open',
  FACE_UNKNOWN: 'Unknown face',
  UNKNOWN_FACE: 'Unknown face',
  FACE_DETECTED: 'Face detected',
  FACE_MATCH: 'Face matched',
  STRANGER: 'Unknown person',
  BLACKLIST: 'Blacklisted person',
  BLACKLISTED_VEHICLE: 'Blacklisted vehicle',
  ANPR: 'Plate recognised',
  ANPR_RESULT: 'Plate recognised',
  PLATE: 'Plate recognised',
  VEHICLE: 'Vehicle detected',
  VEHICLE_DETECTED: 'Vehicle detected',
  CAR: 'Vehicle detected',
  TRUCK: 'Truck detected',
  BUS: 'Bus detected',
  MOTORCYCLE: 'Motorcycle detected',
  PARKING_VIOLATION: 'Parking violation',
  ILLEGAL_PARKING: 'Illegal parking',
  OVERSTAY: 'Overstay',
  VEHICLE_OVERSTAY: 'Overstay',
  WRONG_ZONE: 'Wrong parking zone',
  NO_PERMIT: 'Vehicle without permit',
  MOTION: 'Motion detected',
  MOTION_DETECTED: 'Motion detected',
  CAMERA_EVENT: 'Camera event',
};

/** Aliases vendors use for the same detection class. */
const TYPE_ALIASES: Record<string, string> = {
  INTRUSION_ALERT: 'INTRUSION',
  INTRUDER_DETECTED: 'INTRUSION',
  INTRUSION_DETECTION: 'INTRUSION',
  TRIPWIRE: 'LINE_CROSSING',
  CROSS_LINE: 'LINE_CROSSING',
  PERIMETER_INTRUSION: 'PERIMETER_BREACH',
  UNAUTHORISED_ACCESS: 'UNAUTHORIZED_ACCESS',
  HUMAN_DETECTED: 'PERSON_DETECTED',
  HUMAN_DETECTION: 'PERSON_DETECTED',
  PERSON_DETECTION: 'PERSON_DETECTED',
  PEOPLE_DETECTED: 'PERSON_DETECTED',
  PEDESTRIAN: 'PERSON',
  PEDESTRIAN_DETECTED: 'PERSON',
  VEHICLE_DETECTION: 'VEHICLE_DETECTED',
  CAR_DETECTED: 'CAR',
  TRUCK_DETECTED: 'TRUCK',
  PLATE_NUMBER: 'PLATE',
  LICENSE_PLATE: 'PLATE',
  NUMBER_PLATE: 'PLATE',
  BLACKLISTED_PLATE: 'BLACKLISTED_VEHICLE',
  BLACKLIST_ALERT: 'BLACKLIST',
  FACE_RECOGNITION: 'FACE_DETECTED',
  FACE_UNKNOWN_DETECTED: 'UNKNOWN_FACE',
  STRANGER_DETECTED: 'STRANGER',
  UNKNOWN_PERSON: 'STRANGER',
  LOITER: 'LOITERING',
  LOITERING_DETECTED: 'LOITERING',
  LEFT_OBJECT: 'OBJECT_LEFT',
  ABANDONED: 'ABANDONED_OBJECT',
  OBJECT_MISSING: 'OBJECT_REMOVED',
  MISSING_OBJECT: 'OBJECT_REMOVED',
  CROWD_ALERT: 'CROWD',
  CROWD_DETECTED: 'CROWD',
  FALLEN_PERSON: 'FALL',
  PERSON_FALL: 'FALL',
  FALLEN: 'FALL',
  SMOKE_ALERT: 'SMOKE',
  FIRE_ALERT: 'FIRE',
  FLAME: 'FIRE',
  GAS_DETECTED: 'GAS',
  WEAPON_ALERT: 'WEAPON',
  GUN_DETECTED: 'GUN',
  KNIFE_DETECTED: 'KNIFE',
  FIGHT_DETECTED: 'FIGHT',
  VIOLENCE_DETECTED: 'VIOLENCE',
  SOUND: 'AUDIO',
  AUDIO_DETECTION: 'AUDIO',
  AUDIO_ANOMALY: 'AUDIO',
  GLASS_BREAKING: 'GLASS_BREAK',
  SCREAMING: 'SCREAM',
  CAMERA_BLUR: 'BLURRY',
  BLUR: 'BLURRY',
  LENS_OBSTRUCTED: 'TAMPER',
  VIDEO_BLIND: 'TAMPER',
  CAMERA_MOVED: 'TAMPER',
  SIGNAL_LOST: 'SIGNAL_LOSS',
  OFFLINE: 'CAMERA_OFFLINE',
  NO_VIDEO: 'VIDEO_LOSS',
  DOOR_OPEN: 'DOOR_HELD',
  DOOR_HELD_OPEN: 'DOOR_HELD',
  FORCED_ENTRY: 'DOOR_FORCED',
  GATE_FORCED_OPEN: 'GATE_FORCED',
  TAILGATE: 'TAILGATING',
  PIGGYBACK: 'TAILGATING',
  MOTION_EVENT: 'MOTION',
  MOVEMENT: 'MOTION',
  ILLEGAL_PARK: 'ILLEGAL_PARKING',
  PARKING_ALERT: 'PARKING_VIOLATION',
  PARKING_OVERSTAY: 'OVERSTAY',
  OVERSTAY_ALERT: 'OVERSTAY',
  UNAUTHORIZED_PARKING: 'NO_PERMIT',
  NO_PARKING_PERMIT: 'NO_PERMIT',
  UNKNOWN: 'CAMERA_EVENT',
  UNCLASSIFIED: 'CAMERA_EVENT',
  CCTV_EVENT: 'CAMERA_EVENT',
  MOTION_DETECTION: 'MOTION',
};

/** Keyword → canonical type, used when the vendor string is not in the catalog. */
const KEYWORD_TYPES: Array<[RegExp, string]> = [
  [/weapon|gun|pistol|rifle|firearm|knife|blade/i, 'WEAPON'],
  [/gunshot|shooting|shots?_fired/i, 'GUNSHOT'],
  [/fire(?!arm)|flame|burning|arson/i, 'FIRE'],
  [/smoke/i, 'SMOKE'],
  [/gas|explosion|blast/i, 'GAS'],
  [/fight|violence|assault|brawl/i, 'FIGHT'],
  [/scream|shout|panic|distress/i, 'SCREAM'],
  [/glass/i, 'GLASS_BREAK'],
  [/fall(en)?|collapse/i, 'FALL'],
  [/blacklist|deny_list|denylist/i, 'BLACKLIST'],
  [/tailgat|piggyback/i, 'TAILGATING'],
  [/loiter|linger|idle_person/i, 'LOITERING'],
  [/intru|perimeter|trespass|breach|unauthori[sz]ed|restricted/i, 'INTRUSION'],
  [/line|tripwire|cross/i, 'LINE_CROSSING'],
  [/crowd|gather|group/i, 'CROWD'],
  [/abandon|left_(object|bag|item)|unattended/i, 'ABANDONED_OBJECT'],
  [/missing|removed|stolen|theft|shoplift/i, 'OBJECT_REMOVED'],
  [/tamper|obstruct|blind|covered|moved|defocus|blur/i, 'TAMPER'],
  [/offline|disconnect|no_video|signal|loss|network/i, 'CAMERA_OFFLINE'],
  [/face|unknown_person|stranger|identity/i, 'FACE_DETECTED'],
  [/plate|anpr|lpr|licen[cs]e|number_plate/i, 'PLATE'],
  [/blacklist.*(vehicle|car|plate)|(vehicle|car|plate).*blacklist/i, 'BLACKLISTED_VEHICLE'],
  [/parking|overstay|wrong_zone|no_permit|permit/i, 'PARKING_VIOLATION'],
  [/door|gate|entry|exit/i, 'DOOR_FORCED'],
  [/vehicle|car|truck|bus|motor|bike|van/i, 'VEHICLE_DETECTED'],
  [/person|human|people|pedestrian|man|woman/i, 'PERSON_DETECTED'],
  [/motion|movement|activity/i, 'MOTION'],
];

export function pickString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

export function pickNumber(
  payload: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

export function pickArray(
  payload: Record<string, unknown>,
  keys: string[],
): number[] | null {
  for (const key of keys) {
    const v = payload[key];
    if (Array.isArray(v) && v.length >= 4) {
      const nums = v
        .slice(0, 4)
        .map((n) => (typeof n === 'number' ? n : Number(n)));
      if (nums.every((n) => Number.isFinite(n))) return nums;
    }
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      ['x', 'y', 'w', 'h'].every(
        (k) => typeof (v as Record<string, unknown>)[k] === 'number',
      )
    ) {
      const box = v as Record<string, number>;
      return [box.x, box.y, box.w, box.h];
    }
  }
  return null;
}

function normaliseCode(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw
    .trim()
    .toUpperCase()
    .replace(/[\s./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return code || null;
}

/**
 * Vendor code → canonical detection class. Exact catalog hits win; otherwise a
 * keyword pass maps the usual vendor synonyms (`human_detected`, `tripwire`,
 * `lens_obstructed`, …). Anything still unknown becomes a `CAMERA_EVENT` so the
 * operator sees "Camera event" plus the raw vendor code instead of `CCTV_EVENT`
 * or `Unknown`.
 */
export function resolveDetection(payload: Record<string, unknown>): {
  code: string | null;
  type: string;
  inferred: boolean;
} {
  const code = normaliseCode(
    pickString(payload, [
      'event_type',
      'eventType',
      'alert_type',
      'alertType',
      'detection',
      'label',
      'class',
      'type',
      'alert',
    ]),
  );
  if (!code) return { code: null, type: 'CAMERA_EVENT', inferred: false };
  if (LABELS[code] || CATEGORY_BY_TYPE[code] || SEVERITY_BY_TYPE[code]) {
    return { code, type: TYPE_ALIASES[code] ?? code, inferred: false };
  }
  if (TYPE_ALIASES[code]) {
    return { code, type: TYPE_ALIASES[code], inferred: true };
  }
  const words = code.toLowerCase().replace(/_/g, ' ');
  for (const [pattern, type] of KEYWORD_TYPES) {
    if (pattern.test(words)) return { code, type, inferred: true };
  }
  return { code, type: 'CAMERA_EVENT', inferred: true };
}

/** Raw vendor AI class from any flavour of CCTV_EVENT payload. */
export function detectionCodeFromPayload(
  payload: Record<string, unknown>,
): string | null {
  return resolveDetection(payload).code;
}

/** Canonical AI class (aliases + keyword inference applied). */
export function detectionTypeFromPayload(
  payload: Record<string, unknown>,
): string {
  return resolveDetection(payload).type;
}

export function deriveSeverityFromPayload(
  payload: Record<string, unknown>,
): string {
  return deriveSeverity(detectionTypeFromPayload(payload), payload);
}

export function deriveSeverity(
  detectionType: string,
  payload: Record<string, unknown>,
): string {
  const explicit = normaliseCode(
    pickString(payload, [
      'severity',
      'level',
      'priority',
      'alert_severity',
    ]),
  );
  if (explicit) {
    if (SEVERITY_RANK[explicit]) return explicit;
    if (/CRIT|EMERG|ALARM|FATAL/.test(explicit)) return 'CRITICAL';
    if (/HIGH|MAJOR/.test(explicit)) return 'HIGH';
    if (/MED|WARN|NORMAL/.test(explicit)) return 'MEDIUM';
    if (/LOW|MINOR|INFO/.test(explicit)) return 'LOW';
  }
  const canonical = TYPE_ALIASES[detectionType] ?? detectionType;
  if (CRITICAL_TYPES.has(canonical)) return 'CRITICAL';
  if (HIGH_TYPES.has(canonical)) return 'HIGH';
  if (LOW_TYPES.has(canonical)) return 'LOW';
  if (SEVERITY_BY_TYPE[canonical]) return SEVERITY_BY_TYPE[canonical];
  return 'MEDIUM';
}

export function severityRank(severity: string): number {
  return SEVERITY_RANK[normaliseCode(severity) ?? ''] ?? 1;
}

export function detectionLabel(detectionType: string): string {
  const canonical = TYPE_ALIASES[detectionType] ?? detectionType;
  if (LABELS[canonical]) return LABELS[canonical];
  return (
    canonical
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Camera event'
  );
}

function detectionCategory(detectionType: string): string {
  const canonical = TYPE_ALIASES[detectionType] ?? detectionType;
  if (CATEGORY_BY_TYPE[canonical]) return CATEGORY_BY_TYPE[canonical];
  return 'Camera / motion';
}

function recommendedAction(category: string): string {
  return (
    ACTION_BY_CATEGORY[category] ??
    'Review the live view, acknowledge the alert and record an incident if the event is confirmed.'
  );
}

function normaliseConfidence(raw: number | null): number | null {
  if (raw == null) return null;
  if (raw > 1 && raw <= 100) return Math.round((raw / 100) * 1000) / 1000;
  if (raw >= 0 && raw <= 1) return Math.round(raw * 1000) / 1000;
  return null;
}

function minutesBetween(from: Date | null, now = Date.now()): number | null {
  if (!from) return null;
  const t = from.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60000));
}

function configString(
  config: unknown,
  key: string,
): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const v = (config as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export type RawCctvEvent = {
  id: string;
  type: string;
  status: string;
  routedTo: string | null;
  error: string | null;
  payload: unknown;
  capturedAt: Date;
  receivedAt: Date;
  processedAt: Date | null;
  device: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    vendor: string | null;
    model: string | null;
    siteId: string | null;
    gateId: string | null;
    lastSeenAt: Date | null;
    config: unknown;
  } | null;
};

/** Stable, operator-facing view of one CCTV_EVENT row. */
export function normaliseCctvAlert(
  row: RawCctvEvent,
  site: CctvSiteLabel | undefined,
  incident: CctvIncidentLink | null,
  review?: CctvAlertReview | null,
): CctvAlertView {
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  const detection = resolveDetection(payload);
  const detectionType = detection.type;
  const severity = deriveSeverity(detectionType, payload);
  const confidence = normaliseConfidence(
    pickNumber(payload, ['confidence', 'score', 'probability', 'accuracy']),
  );
  const label = detectionLabel(detectionType);
  const category = detectionCategory(detectionType);
  const camera = row.device
    ? {
        id: row.device.id,
        code: row.device.code,
        name: row.device.name,
        type: row.device.type,
        status: row.device.status,
        vendor: row.device.vendor,
        model: row.device.model,
        siteId: row.device.siteId,
        gateId: row.device.gateId,
        zone: configString(row.device.config, 'zone'),
        nvrChannel: configString(row.device.config, 'nvrChannel'),
        lastSeenAt: row.device.lastSeenAt?.toISOString() ?? null,
      }
    : null;

  const siteId = row.device?.siteId ?? null;
  const zone =
    pickString(payload, ['zone', 'area', 'region', 'checkpoint']) ??
    camera?.zone ??
    null;
  const snapshotUrl = pickString(payload, [
    'snapshot_url',
    'snapshotUrl',
    'imageUrl',
    'image_url',
    'snapshot',
    'thumbnailUrl',
  ]) ?? configString(row.device?.config, 'snapshotUrl');
  const clipUrl = pickString(payload, ['clip_url', 'clipUrl', 'videoUrl']);

  const explicitTitle = pickString(payload, ['title', 'headline']);
  const note = pickString(payload, ['note', 'description', 'message', 'summary']);
  const cameraLabel = camera ? `${camera.name} (${camera.code})` : 'Camera';
  const title = explicitTitle ?? `${label} — ${cameraLabel}`;
  const context = [
    label === 'Camera event' ? null : label,
    `on ${cameraLabel}`,
    zone ? `· ${zone}` : null,
    site?.code ? `· ${site.code}` : null,
    confidence != null ? `· ${Math.round(confidence * 100)}% confidence` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const fallbackNote =
    detectionType === 'CAMERA_EVENT'
      ? detection.code
        ? ` Vendor reported “${detection.code}” without an AI classification — review the live view to confirm.`
        : ' The vendor payload carried no AI classification — review the live view to confirm.'
      : detection.inferred && detection.code
        ? ` Mapped from vendor code “${detection.code}”.`
        : '';
  const summary =
    note ??
    `${
      detectionType === 'CAMERA_EVENT'
        ? `Camera event on ${cameraLabel}`
        : context
    }${zone && detectionType === 'CAMERA_EVENT' ? ` · ${zone}` : ''}${
      site?.code && detectionType === 'CAMERA_EVENT' ? ` · ${site.code}` : ''
    }.${fallbackNote}`.trim();

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    routedTo: row.routedTo,
    error: row.error,
    capturedAt: row.capturedAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
    ageMinutes: minutesBetween(row.capturedAt),
    open: row.status === 'RECEIVED' || row.status === 'FAILED',
    detectionType,
    detectionLabel: label,
    detectionCategory: category,
    detectionCode: detection.code,
    detectionInferred: detection.inferred,
    severity,
    severityRank: severityRank(severity),
    confidence,
    confidencePct: confidence == null ? null : Math.round(confidence * 100),
    zone,
    camera,
    siteId,
    siteCode: site?.code ?? null,
    siteName: site?.name ?? null,
    plateNumber: pickString(payload, [
      'plateNumber',
      'plate_number',
      'plate',
      'vehiclePlate',
      'vehicle_plate',
    ]),
    objectClass: pickString(payload, [
      'object_class',
      'objectClass',
      'class_name',
      'className',
      'person_type',
    ]),
    personCount: pickNumber(payload, [
      'person_count',
      'personCount',
      'people',
      'count',
    ]),
    boundingBox: pickArray(payload, [
      'bbox',
      'bounding_box',
      'boundingBox',
      'box',
    ]),
    snapshotUrl,
    clipUrl,
    title,
    summary,
    recommendedAction: recommendedAction(category),
    incident,
    review: review ?? {
      acknowledgedByName: null,
      acknowledgedAt: null,
      note: null,
      incidentByName: null,
      incidentAt: null,
    },
    payload,
  };
}

/** Lightweight sort used by the wall + alert inbox (critical first, then newest). */
export function compareAlerts(a: CctvAlertView, b: CctvAlertView): number {
  if (a.open !== b.open) return a.open ? -1 : 1;
  if (b.severityRank !== a.severityRank) return b.severityRank - a.severityRank;
  return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
}
