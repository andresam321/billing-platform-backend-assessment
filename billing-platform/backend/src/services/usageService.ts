import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/inMemoryDb';
import { UsageEvent } from '../types';

export const usageService = {
  /**
   * Records a new API usage event.
   *
   * BUG-3a (No deduplication): The idempotencyKey field in the request body
   * is stored but never checked. Clients that retry on network failure, or
   * users that double-submit (rapid duplicate clicks), silently create
   * multiple events — inflating currentUsage counts.
   *
   * Fix: Before inserting, check if an event with the same idempotencyKey
   * already exists for this user and return the existing record if found.
   */
  trackEvent(
    userId: string,
    endpoint: string,
    cost: number = 1,
    metadata: Record<string, unknown> = {},
    idempotencyKey?: string
  ): UsageEvent {
    // BUG-3a: idempotencyKey is accepted but never checked against existing events.
    const event: UsageEvent = {
      id: uuidv4(),
      userId,
      endpoint,
      cost,
      idempotencyKey,
      metadata,
      timestamp: new Date().toISOString(),
    };

    db.usageEvents.push(event);
    return event;
  },

  getEventsForUser(userId: string): UsageEvent[] {
    return db.usageEvents.filter(e => e.userId === userId);
  },

  /**
   * Calculates total cost for one user by scanning all events.
   * O(n) per call — acceptable in isolation.
   *
   * BUG-3b (Performance): This method is called inside a .map() loop in
   * getUsageSummary(), making the summary operation O(n²) in total event
   * count. With 10k events across 1k users, this runs 10M iterations.
   */
  getTotalCostForUser(userId: string): number {
    return db.usageEvents
      .filter(e => e.userId === userId)
      .reduce((sum, e) => sum + e.cost, 0);
  },

  /**
   * Returns a per-user usage summary for admin reporting.
   *
   * BUG-3b (O(n²)): For each unique userId, performs two full O(n) scans:
   *   1. filter + .length  → O(n)
   *   2. getTotalCostForUser → another filter + reduce → O(n)
   *
   * With m users and n total events, this is O(m × n) ≈ O(n²).
   *
   * Fix: single-pass accumulation using a Map<userId, {count, cost}>.
   */
  getUsageSummary(): Array<{ userId: string; eventCount: number; totalCost: number }> {
    const userIds = [...new Set(db.usageEvents.map(e => e.userId))];

    return userIds.map(uid => ({
      userId: uid,
      eventCount: db.usageEvents.filter(e => e.userId === uid).length, // O(n)
      totalCost: this.getTotalCostForUser(uid),                         // O(n) again
    }));
  },
};
