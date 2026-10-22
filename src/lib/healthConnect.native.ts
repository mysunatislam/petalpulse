/**
 * Health Connect adapter (Android). Read-only: the app asks only for read
 * permissions and never writes. Readings are converted to a simple shape
 * (°C, bpm) and summarised by engines/wearables.ts; nothing raw is stored.
 */
import { Platform } from 'react-native';
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';
import type { WearableMetric } from '../data/types';
import { EMPTY_RAW, RawHealth } from '../engines/wearables';

export type HealthStatus = 'available' | 'needs_update' | 'unavailable';

/** Health Connect record types behind each metric the person can choose. */
const RECORDS: Record<WearableMetric, RecordType[]> = {
  sleep: ['SleepSession'],
  steps: ['Steps'],
  restingHr: ['RestingHeartRate'],
  temperature: ['SkinTemperature', 'BasalBodyTemperature'],
};

const read = (metrics: WearableMetric[]): Permission[] =>
  metrics.flatMap((m) => RECORDS[m].map((recordType) => ({ accessType: 'read' as const, recordType })));

let ready = false;
async function init(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!ready) ready = await initialize();
  return ready;
}

export async function healthStatus(): Promise<HealthStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs_update';
  } catch {
    // fall through
  }
  return 'unavailable';
}

/** A metric counts as granted only when every record type behind it is. */
function toMetrics(granted: { accessType: string; recordType: string }[]): WearableMetric[] {
  const has = new Set(granted.filter((g) => g.accessType === 'read').map((g) => g.recordType));
  return (Object.keys(RECORDS) as WearableMetric[]).filter((m) => RECORDS[m].some((r) => has.has(r)));
}

export async function requestHealthAccess(metrics: WearableMetric[]): Promise<WearableMetric[]> {
  if (!(await init())) return [];
  const granted = await requestPermission(read(metrics));
  return toMetrics(granted as Permission[]).filter((m) => metrics.includes(m));
}

export async function grantedMetrics(): Promise<WearableMetric[]> {
  if (!(await init())) return [];
  try {
    return toMetrics((await getGrantedPermissions()) as Permission[]);
  } catch {
    return [];
  }
}

async function all<T extends RecordType>(type: T, from: Date, to: Date) {
  const out = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords(type, {
      timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: to.toISOString() },
      pageSize: 1000,
      pageToken,
    });
    out.push(...res.records);
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return out;
}

/** Reads only the chosen metrics that are still granted. A failed type is skipped, not fatal. */
export async function readHealth(metrics: WearableMetric[], from: Date, to: Date): Promise<RawHealth> {
  if (!(await init())) return EMPTY_RAW;
  const allowed = new Set(await grantedMetrics());
  const want = (m: WearableMetric) => metrics.includes(m) && allowed.has(m);
  const raw: RawHealth = { sleep: [], steps: [], restingHr: [], tempDelta: [], bbt: [] };
  const safe = async (f: () => Promise<void>) => {
    try {
      await f();
    } catch {
      // permission revoked mid-read or no data source: skip this type
    }
  };
  if (want('sleep')) await safe(async () => {
    raw.sleep = (await all('SleepSession', from, to)).map((r) => ({ start: r.startTime, end: r.endTime }));
  });
  if (want('steps')) await safe(async () => {
    raw.steps = (await all('Steps', from, to)).map((r) => ({ start: r.startTime, end: r.endTime, count: r.count }));
  });
  if (want('restingHr')) await safe(async () => {
    raw.restingHr = (await all('RestingHeartRate', from, to)).map((r) => ({ time: r.time, bpm: r.beatsPerMinute }));
  });
  if (want('temperature')) {
    await safe(async () => {
      raw.tempDelta = (await all('SkinTemperature', from, to)).flatMap((r) => r.deltas.map((d) => ({ time: d.time, celsius: d.delta.inCelsius })));
    });
    await safe(async () => {
      raw.bbt = (await all('BasalBodyTemperature', from, to)).map((r) => ({ time: r.time, celsius: r.temperature.inCelsius }));
    });
  }
  return raw;
}

export function openHealthSettings() {
  try {
    openHealthConnectSettings();
  } catch {
    // Health Connect missing
  }
}
