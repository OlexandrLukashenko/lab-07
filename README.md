# Lab 07 — TypeScript, Zod and authoritative multiplayer

A small deterministic multiplayer space arena. The server is the authority: clients send control input, never positions. The server advances the world at a target 30 Hz and broadcasts snapshots. Rooms, room chat, runtime message validation, a binary input packet, a basic HUD and network status indicator are included.

## Requirements

- Node.js 20+ (Node 22 recommended)
- npm

## Run locally

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run dev
```

Open <http://localhost:5173>. The WebSocket server listens on port 3000. In Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. To build, run `npm run build`.

## Controls

- `W` / `↑`: thrust
- `A` / `←` and `D` / `→`: turn
- `Space`: fire (server rate-limits shots)
- Use the lobby panel to change your pilot name or join a room; use Comms to chat with the room.

## TypeScript concepts used

1. **Structural typing and inference.** `Vec2`, `Ship`, and `Snapshot` describe the shape of values. Zod infers `ClientMessage` from its runtime schema, so the static type and input contract stay together.
2. **`unknown` at trust boundaries.** Incoming JSON starts as `unknown`, then Zod validates it. Parse failures are caught and the WebSocket is closed. Catch clauses use `unknown` and narrow with `instanceof Error`.
3. **Discriminated unions and `never`.** Network messages use a `type` field; world entities use `kind`. Switch statements have a `default` branch assigning the value to `never`, so adding a union member without handling it fails typechecking.
4. **Generics and `readonly`.** `Brand<T, Name>` reuses a generic type to distinguish entity IDs, simulation steps and packet sequence numbers. Vector coordinates and snapshot collections are readonly at the API boundary.
5. **Strict configuration.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables` are enabled. `npm run typecheck` runs in GitHub Actions.

## Validation and deterministic simulation

`shared/protocol.ts` uses Zod for untrusted JSON and checks binary packet size, magic value, protocol version, numeric ranges, and flag bytes before decoding. The deterministic test runs an identical input sequence twice and compares serialized snapshots. Run it with `npm test`.

## What TypeScript helps catch

During implementation, strict typing makes mismatched entity identifiers, missing message branches, possibly missing indexed/DOM values, and inconsistent network message shapes visible at compile time. Branded ID/tick/sequence types help stop mixing values that are all represented as strings/numbers at runtime. Runtime validation is still necessary because TypeScript types are erased when compiled and cannot validate network data.

## Framework decision

The lobby and HUD are small, so this version uses plain TypeScript and DOM APIs instead of adding React, Vue, or Svelte. The canvas renderer and game loop remain framework-free as requested. If the lobby becomes much larger, a UI framework could help manage its state, but it would not replace runtime protocol validation.

## Architecture

- `shared/types.ts` — readonly domain types, brands, Zod schemas, message unions.
- `shared/simulation.ts` — deterministic world updates and snapshots.
- `shared/protocol.ts` — Zod parsing and versioned binary input decoder/encoder.
- `server/index.ts` — WebSocket connections, rooms/chat, authoritative tick loop and input validation.
- `client/main.ts` — canvas, input-only controls, HUD, lobby and chat.
- `tests/determinism.test.ts` — deterministic simulation and protocol validation checks.

## Protocol note

JSON is used for chat, lobby, room operations, and snapshots. The binary input format is available for compact input packets and is validated independently. This keeps the protocol easy to inspect during the lab while demonstrating strict binary decoding.


## Lab 06: tests, load and performance

[![CI](https://github.com/OlexandrLukashenko/lab-05/actions/workflows/ci.yml/badge.svg)](https://github.com/OlexandrLukashenko/lab-05/actions/workflows/ci.yml)

- `npm run test:coverage`: Vitest unit/property tests, with an 85% line/statement threshold for `shared/`.
- `fast-check` generates movement inputs, packet values, invalid packet lengths, and valid message names.
- `npm run test:e2e`: Playwright opens two independent browser pages, joins them to the same room and verifies chat delivery.
- `npm run perf:bots`: headless WebSocket clients at 8, 32, 64 and 128; set `DURATION_MS=30000` for a 30-second run per group.
- `npm run lint` runs strict TypeScript checks; CI runs typecheck, lint, tests/coverage, Playwright and build on push and pull request.

### Three V8 concepts
1. **Bytecode, JIT, deoptimization:** V8 compiles source to bytecode, optimizes hot paths, and may deoptimize if observed runtime values break assumptions.
2. **Hidden classes and inline caches:** objects with the same property layout tend to share shapes, making property access easier to optimize.
3. **Garbage collection:** unreachable objects are reclaimed. Many short-lived allocations can cause extra GC work; pooling helps only when a profile shows allocation churn is a bottleneck.

### Performance conclusion
See `PERFORMANCE.md`. No actual browser profile was available during archive preparation, so performance numbers are intentionally not invented. The current simulation has no all-pairs collision loop, and a Web Worker is not kept without a measured main-thread improvement.
