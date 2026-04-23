import { useState, useEffect } from 'react';

interface UsageEvent {
  id: string;
  endpoint: string;
  cost: number;
  timestamp: string;
  idempotencyKey?: string;
}

interface Props {
  userId: string;
  token: string;
  /** Incremented by parent after a track event to signal a refresh. */
  refreshTick: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function UsagePanel({ userId, token, refreshTick }: Props) {
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsage() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/usage/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        /**
         * BUG-5 (API contract mismatch — frontend side):
         *
         * The backend GET /usage/:userId returns:
         *   { events: UsageEvent[], total: number }
         *
         * This component destructures:
         *   { data, count }
         *
         * Both `data` and `count` will be `undefined`. The fallbacks (`?? []`
         * and `?? 0`) silently mask the error — the panel renders "0 events"
         * with an empty table regardless of actual usage history.
         *
         * No console error is thrown. The only visible symptom is that the
         * panel is always empty.
         *
         * Fix option A (backend): rename response fields to { data, count }
         * Fix option B (frontend): change destructuring to { events: data, total: count }
         */
        const { data, count: eventCount } = json;

        if (!cancelled) {
          setEvents(data ?? []);      // data is undefined  → falls back to []
          setCount(eventCount ?? 0);  // eventCount is undefined → falls back to 0
        }
      } catch {
        if (!cancelled) setError('Failed to load usage history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUsage();
    return () => { cancelled = true; };
  }, [userId, token, refreshTick]); // refreshTick dep is correct here — parent bug is in Dashboard

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Usage History ({count} events)</h2>

      {loading && <p style={muted}>Loading…</p>}
      {error && <p style={errorStyle}>{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p style={muted}>No usage events found.</p>
        // This is always shown due to BUG-5 — even when events exist server-side.
      )}

      {!loading && events.length > 0 && (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Endpoint</th>
              <th style={th}>Cost</th>
              <th style={th}>Idempotency Key</th>
              <th style={th}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={td}><code>{e.endpoint}</code></td>
                <td style={td}>{e.cost}</td>
                <td style={{ ...td, color: '#888', fontSize: 11 }}>{e.idempotencyKey ?? '—'}</td>
                <td style={td}>{new Date(e.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 16,
  fontWeight: 600,
};

const muted: React.CSSProperties = { color: '#666', fontSize: 14, margin: '8px 0' };
const errorStyle: React.CSSProperties = { color: '#b91c1c', fontSize: 14 };

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '2px solid #e2e8f0',
  fontWeight: 600,
  color: '#555',
};

const td: React.CSSProperties = {
  padding: '6px 10px',
};
