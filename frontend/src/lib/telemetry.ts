const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type TelemetryPayload = {
  event: string;
  lang?: string;
  seed?: number;
  status?: string;
  query_length?: number;
  attempts?: number;
  metadata?: Record<string, unknown>;
};

function postJson(payload: TelemetryPayload) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(`${API_BASE}/telemetry`, blob);
    return;
  }

  fetch(`${API_BASE}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Telemetry should never interrupt gameplay.
  });
}

export function trackEvent(payload: TelemetryPayload) {
  postJson(payload);
}

export function trackError(event: string, error: unknown, metadata?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  postJson({
    event,
    status: 'error',
    metadata: {
      ...metadata,
      message,
    },
  });
}
