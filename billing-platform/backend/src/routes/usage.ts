import { Router } from 'express';
import { usageService } from '../services/usageService';
import { subscriptionService } from '../services/subscriptionService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * POST /usage/track
 * Records an API usage event for the authenticated user.
 * Enforces monthly quota before recording.
 */
router.post('/track', authMiddleware, (req, res) => {
  const { endpoint, cost, metadata, idempotencyKey } = req.body;

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'endpoint is required and must be a string' });
  }

  const userId = req.userId!;

  // Quota enforcement — BUG-2 lives inside checkQuota
  try {
    subscriptionService.checkQuota(userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Quota error';
    return res.status(429).json({ error: message, code: 'QUOTA_EXCEEDED' });
  }

  // BUG-3a: idempotencyKey is forwarded but never checked for duplicates
  const event = usageService.trackEvent(
    userId,
    endpoint,
    typeof cost === 'number' && cost > 0 ? cost : 1,
    typeof metadata === 'object' && metadata !== null ? metadata : {},
    typeof idempotencyKey === 'string' ? idempotencyKey : undefined
  );

  subscriptionService.incrementUsage(userId);

  return res.status(201).json({ event });
});

/**
 * GET /usage/:userId
 * Returns usage event history for a user.
 *
 * BUG-5 (API Contract): This endpoint returns { events, total } but the
 * frontend UsagePanel component destructures { data, count } from the
 * response. Both fields resolve to undefined on the client, so the panel
 * silently renders "0 events" with an empty list regardless of actual data.
 *
 * Fix: Either rename the response fields to { data, count }, or update
 * the frontend destructuring to match { events, total }.
 * The mismatch is easy to miss because there is no runtime error thrown —
 * the panel simply shows empty state.
 */
router.get('/:userId', authMiddleware, (req, res) => {
  const { userId } = req.params;

  if (userId !== req.userId && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const events = usageService.getEventsForUser(userId);

  // BUG-5: Field names don't match what the frontend expects.
  return res.json({
    events,          // frontend reads: data  → undefined
    total: events.length, // frontend reads: count → undefined
  });
});

/**
 * GET /usage/summary/all
 * Admin-only aggregate usage report.
 * BUG-3b: Triggers the O(n²) getUsageSummary call.
 */
router.get('/summary/all', authMiddleware, (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }

  const summary = usageService.getUsageSummary();
  return res.json({ summary, generatedAt: new Date().toISOString() });
});

export default router;
