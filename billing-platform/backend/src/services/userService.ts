import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/inMemoryDb';
import { User } from '../types';

/**
 * Minimal password hashing for demo purposes.
 * Not for production — use bcrypt or argon2 in real systems.
 */
function hashPassword(password: string): string {
  return Buffer.from(password + 'salt_key_v1').toString('base64');
}

export const userService = {
  /**
   * Creates a new user account and returns the user record.
   *
   * BUG-1 (Security): Returns the full User object including passwordHash.
   * Callers that forward this to API responses expose credential-adjacent data.
   * Fix: strip passwordHash before returning, or return a SafeUser projection.
   */
  createUser(email: string, name: string, password: string): User {
    if (db.users.some(u => u.email === email)) {
      throw new Error('Email already registered');
    }

    const user: User = {
      id: uuidv4(),
      email,
      name,
      passwordHash: hashPassword(password),
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    return user; // full object — passwordHash included
  },

  /**
   * Looks up a user by ID.
   *
   * BUG-1 (continued): No field projection. passwordHash travels
   * all the way through the call stack to the HTTP response.
   */
  getUserById(id: string): User | undefined {
    return db.users.find(u => u.id === id);
  },

  listUsers(): User[] {
    // BUG-1 (continued): All users returned with passwordHash.
    return [...db.users];
  },
};
