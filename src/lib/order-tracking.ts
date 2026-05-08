export type TrackingMode = 'demo' | 'live' | 'auto_fallback';
export type TrackingSource = 'manual' | 'gps' | 'none';

export type TrackingPoint = {
  latitude: number;
  longitude: number;
  updatedAt: string | null;
  note: string | null;
  updatedBy: string | null;
  heading: number | null;
  speedKph: number | null;
  provider: string | null;
};

export type OrderTracking = {
  orderId: string;
  mode: TrackingMode;
  gpsSignalFresh: boolean;
  activeSource: TrackingSource;
  activeLocation: TrackingPoint | null;
  manualLocation: TrackingPoint | null;
  gpsLocation: TrackingPoint | null;
  updatedAt: string;
};

export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  demo: 'Demo / Manual',
  live: 'Live GPS',
  auto_fallback: 'Auto fallback',
};

export const TRACKING_SOURCE_LABELS: Record<TrackingSource, string> = {
  manual: 'Manual',
  gps: 'GPS',
  none: 'No signal',
};
