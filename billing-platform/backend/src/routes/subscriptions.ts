import { Router } from 'express';
import { subscriptionService } from '../services/subscriptionService';
import { authMiddleware } from '../middleware/auth';
import { isValidPlan } from '../validation/validators';
import { Plan } from '../types';

const router = Router();

/**
 * GET /subscriptions/:userId
 * Returns the subscription for the given user.
 */
router.get('/:userId', authMiddleware, (req, res) => {
  const { userId } = req.params;

  // Allow users to view their own subscription; admins can view any
  if (userId !== req.userId && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const subscription = subscriptionService.getSubscription(userId);
    return res.json({ subscription });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Not found';
    return res.status(404).json({ error: message });
  }
});

/**
 * POST /subscriptions/upgrade
 * Changes a subscription to a new plan tier.
 *
 * BUG-6 (Security / Authorization): The userId to upgrade is sourced from
 * req.body, not from req.userId (the authenticated user's identity).
 *
 * Any authenticated user can upgrade ANY other user's subscription by
 * sending an arbitrary userId in the request body. The auth token is
 * validated (user must be logged in), but authorization is not checked
 * (the acting user is never compared to the target userId).
 *
 * Fix: replace `userId` with `req.userId` in the service call, and remove
 * userId from the required request body fields.
 */
router.post('/upgrade', authMiddleware, (req, res) => {
  const { userId, plan } = req.body;

  if (!userId || !plan) {
    return res.status(400).json({ error: 'userId and plan are required' });
  }

  if (!isValidPlan(plan)) {
    return res.status(400).json({
      error: `Invalid plan. Must be one of: free, pro, enterprise`,
    });
  }

  try {
    // BUG-6: Should be subscriptionService.upgradePlan(req.userId!, plan)
    const subscription = subscriptionService.upgradePlan(userId as string, plan as Plan);
    return res.json({ subscription });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upgrade failed';
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /subscriptions/:userId/cancel
 * Cancels a subscription. Users can only cancel their own.
 */
router.post('/:userId/cancel', authMiddleware, (req, res) => {
  const { userId } = req.params;

  if (userId !== req.userId && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const subscription = subscriptionService.cancelSubscription(userId);
    return res.json({ subscription });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cancel failed';
    return res.status(400).json({ error: message });
  }
});

export default router;
