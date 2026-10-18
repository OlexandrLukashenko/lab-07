export interface RateLimitState { windowStartedAt: number; count: number }

/** Fixed-window limiter. Returns true when an event is permitted. */
export function allowRate(state: RateLimitState, now: number, limit: number, windowMs: number): boolean {
  if (now - state.windowStartedAt >= windowMs || now < state.windowStartedAt) {
    state.windowStartedAt = now;
    state.count = 0;
  }
  if (state.count >= limit) return false;
  state.count += 1;
  return true;
}
