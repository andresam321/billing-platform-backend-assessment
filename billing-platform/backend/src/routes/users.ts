import { Router } from 'express';
import { userService } from '../services/userService';
import { subscriptionService } from '../services/subscriptionService';
import { authMiddleware } from '../middleware/auth';
import { isValidEmail, sanitizeString } from '../validation/validators';

const router = Router();

/**
 * POST /users
 * Register a new user. Creates a default free subscription.
 */
router.post('/', (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }

  const cleanEmail = sanitizeString(email).toLowerCase();

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const user = userService.createUser(cleanEmail, sanitizeString(name), password);

    // Provision a default free subscription on registration
    subscriptionService.createSubscription(user.id);

    // BUG-1: `user` object is passed directly to the response.
    // userService.createUser returns the full User record including passwordHash.
    return res.status(201).json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Email already registered') {
      return res.status(409).json({ error: message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /users/:id
 * Fetch a user profile by ID. Requires authentication.
 */
router.get('/:id', authMiddleware, (req, res) => {
  const user = userService.getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // BUG-1: userService.getUserById returns the raw DB record.
  // passwordHash is included in the response body.
  return res.json({ user });
});

/**
 * GET /users
 * List all users. Admin only.
 */
router.get('/', authMiddleware, (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }

  // BUG-1: All users returned including passwordHash fields.
  const users = userService.listUsers();
  return res.json({ users });
});

export default router;
