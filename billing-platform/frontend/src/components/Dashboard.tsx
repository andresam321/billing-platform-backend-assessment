import { useState, useEffect } from 'react';
import UsagePanel from './UsagePanel';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  monthlyLimit: number;
  currentUsage: number;
  billingCycleStart: string;
}

interface Props {
  userId: string;
  token: string;
}

const PLAN_COLORS: Record<string, string> = {
  free: '#888',
  pro: '#1a6fa8',
  enterprise: '#7c3aed',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard({ userId, token }: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  const [upgradeStatus, setUpgradeStatus] = useState<string | null>(null);

  /**
   * BUG-7 (Frontend — stale state after mutation):
   *
   * `refreshTick` is incremented after a successful usage track, intended to
   * signal that the subscription data (currentUsage) should be re-fetched.
   *
   * However, the useEffect below does NOT include `refreshTick` in its
   * dependency array. React will never re-run the effect when refreshTick
   * changes, so the subscription card always shows the usage count from the
   * initial load — it goes stale immediately after the first track event.
   *
   * Fix: add `refreshTick` to the dependency array:
   *   }, [userId, token, refreshTick]);
   */
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchSubscription() {
      setSubLoading(true);
      setSubError(null);
      try {
        const res = await fetch(`/api/subscriptions/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSubscription(data.subscription);
      } catch {
        if (!cancelled) setSubError('Failed to load subscription data.');
      } finally {
        if (!cancelled) setSubLoading(false);
      }
    }

    fetchSubscription();
    return () => { cancelled = true; };

  // BUG-7: `refreshTick` is intentionally omitted from this dependency array.
  // Subscription data will not re-fetch after usage events are tracked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]); // ← missing: refreshTick

  // ── Track usage ─────────────────────────────────────────────────────────────

  const handleTrackUsage = async () => {
    if (trackLoading) return;
    setTrackLoading(true);
    setTrackStatus(null);

    try {
      const res = await fetch('/api/usage/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: '/api/data', cost: 1 }),
      });

      const body = await res.json();

      if (!res.ok) {
        setTrackStatus(`⚠ ${body.error ?? 'Request failed'}`);
        return;
      }

      setTrackStatus('✓ Event tracked');
      // Increment refreshTick — intended to trigger subscription re-fetch,
      // but the useEffect above doesn't depend on it, so nothing re-fetches.
      setRefreshTick(t => t + 1);
    } catch {
      setTrackStatus('⚠ Network error');
    } finally {
      setTrackLoading(false);
    }
  };

  // ── Upgrade plan ─────────────────────────────────────────────────────────────

  const handleUpgrade = async (plan: string) => {
    setUpgradeStatus(null);
    try {
      const res = await fetch('/api/subscriptions/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Note: sends userId in body — BUG-6 in the backend accepts this without
        // verifying it matches the authenticated user.
        body: JSON.stringify({ userId, plan }),
      });

      const body = await res.json();
      if (!res.ok) {
        setUpgradeStatus(`⚠ ${body.error ?? 'Upgrade failed'}`);
        return;
      }

      // Upgrade response does update the subscription state correctly here
      setSubscription(body.subscription);
      setUpgradeStatus(`✓ Upgraded to ${plan}`);
    } catch {
      setUpgradeStatus('⚠ Network error');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Subscription card */}
      <section style={card}>
        <h2 style={sectionTitle}>Subscription</h2>

        {subLoading && <p style={muted}>Loading…</p>}
        {subError && <p style={errorText}>{subError}</p>}

        {!subLoading && subscription && (
          <div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat label="Plan">
                <span style={{ color: PLAN_COLORS[subscription.plan] ?? '#333', fontWeight: 600 }}>
                  {subscription.plan.toUpperCase()}
                </span>
              </Stat>
              <Stat label="Status">{subscription.status}</Stat>
              <Stat label="Usage">
                {subscription.currentUsage} / {subscription.monthlyLimit} calls
                {/* NOTE: this counter does not update after tracking — BUG-7 */}
              </Stat>
              <Stat label="Billing cycle">
                {new Date(subscription.billingCycleStart).toLocaleDateString()}
              </Stat>
            </div>

            <UsageBar used={subscription.currentUsage} limit={subscription.monthlyLimit} />
          </div>
        )}
      </section>

      {/* Track usage */}
      <section style={card}>
        <h2 style={sectionTitle}>Track API Usage</h2>
        <p style={muted}>Simulates an API call against your quota.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={btn} onClick={handleTrackUsage} disabled={trackLoading}>
            {trackLoading ? 'Tracking…' : 'Track Event'}
          </button>
          {trackStatus && (
            <span style={{ fontSize: 13, color: trackStatus.startsWith('✓') ? '#2d6a2d' : '#b91c1c' }}>
              {trackStatus}
            </span>
          )}
        </div>
        <p style={{ ...muted, marginTop: 8, fontSize: 12 }}>
          ⚠ The usage counter above does not refresh after tracking. Why?
        </p>
      </section>

      {/* Upgrade plan */}
      <section style={card}>
        <h2 style={sectionTitle}>Change Plan</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['free', 'pro', 'enterprise'] as const).map(plan => (
            <button
              key={plan}
              style={{ ...btn, background: PLAN_COLORS[plan] }}
              onClick={() => handleUpgrade(plan)}
            >
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </button>
          ))}
        </div>
        {upgradeStatus && (
          <p style={{ fontSize: 13, marginTop: 8, color: upgradeStatus.startsWith('✓') ? '#2d6a2d' : '#b91c1c' }}>
            {upgradeStatus}
          </p>
        )}
      </section>

      {/* Usage history panel */}
      <UsagePanel userId={userId} token={token} refreshTick={refreshTick} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>{children}</div>
    </div>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct > 90 ? '#b91c1c' : pct > 70 ? '#d97706' : '#16a34a';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ background: '#eee', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{pct.toFixed(1)}% of monthly quota used</div>
    </div>
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

const muted: React.CSSProperties = {
  margin: '0 0 10px',
  color: '#666',
  fontSize: 14,
};

const errorText: React.CSSProperties = {
  color: '#b91c1c',
  fontSize: 14,
};

const btn: React.CSSProperties = {
  padding: '7px 16px',
  background: '#1a6fa8',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};
