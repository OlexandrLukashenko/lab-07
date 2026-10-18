# Lab 06 performance protocol and results

## Repeatable run
1. `npm run dev` in one terminal.
2. `DURATION_MS=30000 npm run perf:bots` in another. The script connects 8, 32, 64, and 128 headless clients and reports p50/p95/p99 for client-side input-batch duration plus snapshots received.
3. To measure **server tick** duration (the 33 ms requirement), run Node with `--cpu-prof` and add `performance.now()` around `tick(world)` in `server/index.ts`; record tick duration percentiles separately. The bot probe does not falsely label client send time as server tick time.
4. In Chrome DevTools Performance, record a 30-second session with eight bots. Save traces before/after; inspect Frames, GC events, Bottom-Up and Allocation instrumentation, then save flame-chart screenshots.

## Measurements
This source environment did not execute a browser/server profile, so no p50/p95/p99 frame numbers, GC pause durations, allocation rankings or flame-chart screenshots are fabricated here. Run the procedure above on the target machine and paste measured values/screenshots into this section. Target: p99 frame under 16.7 ms and no long GC pauses.

## Optimization decision
- The authoritative simulation currently has no all-pairs collision pass, so a spatial hash would add complexity without reducing an existing hot loop.
- Bullets are replaced immutably during simulation and snapshots are newly assembled. A mutable pool should be added only after allocation profiling confirms bullet churn is a major source; premature pooling risks mutating state already serialized for clients.
- No Web Worker is retained: this environment provided no before/after trace showing a faster main thread. The authoritative simulation already runs on the server; moving simple rendering work to a worker adds messaging overhead.
- The renderer reuses a precomputed star field and draws directly on Canvas. No vector object is created per star per frame.
