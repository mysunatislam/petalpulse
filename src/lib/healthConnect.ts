/**
 * Health Connect adapter: web preview and tests. Health Connect is Android
 * only, so here it always reports unavailable. The Android version is
 * healthConnect.native.ts.
 */
import type { WearableMetric } from '../data/types';
import { EMPTY_RAW, RawHealth } from '../engines/wearables';

export type HealthStatus = 'available' | 'needs_update' | 'unavailable';

export async function healthStatus(): Promise<HealthStatus> {
  return 'unavailable';
}

export async function requestHealthAccess(_metrics: WearableMetric[]): Promise<WearableMetric[]> {
  return [];
}

export async function grantedMetrics(): Promise<WearableMetric[]> {
  return [];
}

export async function readHealth(_metrics: WearableMetric[], _from: Date, _to: Date): Promise<RawHealth> {
  return EMPTY_RAW;
}

export function openHealthSettings() {}
