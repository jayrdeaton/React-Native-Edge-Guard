# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# @tastic/edge-guard

Opt-in guard against iOS's top- and bottom-edge system gestures (Notification Center / Control
Center at the top; the home-indicator swipe and Reachability at the bottom) firing over a
full-screen or edge-anchored touch control zone. An Expo config plugin swizzles the relevant
UIKit getter; a hook drives it live from a settings toggle.

Part of the `@tastic`/`@rific` package ecosystem. Published to the public npm registry (no
`private` field, `publishConfig.access: "public"`) — `0.1.1` is live at
`registry.npmjs.org/@tastic/edge-guard` and is what AirHockey and Pong currently install.

## Commands

```bash
npm run lint        # ESLint
npm run fix         # ESLint --fix
npm test            # Jest
npm run test:watch  # Jest --watchAll
npm run typecheck   # TypeScript type check (tsc --noEmit)
npm run build       # tsup -> dist/ (CJS + ESM + .d.ts)
npm run build:watch # tsup --watch
npm run verify      # lint && test && typecheck && build, in that order
```

Always run `npm run lint` before finishing any task.

## Release

`0.1.1` has already been published this way; the tag-based mechanism is exercised, not just wired:

```bash
npm run release:patch   # npm version patch && git push --follow-tags (or release:minor / release:major)
```

`preversion` runs `npm run verify` first; `prepublishOnly` runs `npm run build`. `.github/workflows/publish.yml`
fires on `v*` tags and delegates to the shared reusable workflow
(`infinitetoken/Workflows/.github/workflows/npm-publish.yml@v1`) with `id-token: write` permission
for OIDC trusted publishing — same mechanism as the rest of the fleet. `.github/workflows/ci.yml`
runs on every PR and push to `main` via the shared `npm-ci.yml@v1` reusable workflow, which invokes
this package's own `verify` script.

## Architecture

```
src/
  index.ts                     - public exports: EDGE_GUARD_USER_DEFAULTS_KEY, useEdgeGestureGuard
  useEdgeGestureGuard.ts       - the hook: mirrors `enabled` into native UserDefaults via RN's built-in Settings bridge, iOS only, no-ops elsewhere
  __mocks__/
    react-native.ts            - jest mock: Platform.OS ('ios'), Settings.set (jest.fn())
  __tests__/
    useEdgeGestureGuard.test.ts
plugin/
  withEdgeGestureGuard.cjs     - Expo config plugin: swizzles UIViewController.preferredScreenEdgesDeferringSystemGestures in AppDelegate.swift, re-queries every window's root view controller on UserDefaults.didChangeNotification so a mid-session toggle takes effect without a restart
app.plugin.js                  - Expo plugin entry point (what "plugins": ["@tastic/edge-guard"] in app.json resolves to); re-exports plugin/withEdgeGestureGuard.cjs
```

**Must be named `app.plugin.js` exactly — not `.cjs`.** An earlier version of this file was named `app.plugin.cjs` on the theory that Expo's plugin resolver probes multiple extensions (`.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, `.mts`) via `pluginExtensions` in `@expo/config-plugins/build/utils/plugin-resolver.js` — true for the project's own locally-installed `@expo/config-plugins` (confirmed at 57.0.9), but **false** for the resolver `eas build --local`/EAS Build actually uses: `eas-cli` bundles its own older, separately-versioned `@expo/config-plugins` (confirmed at 55.0.7, under `eas-cli/node_modules`), whose `resolvePluginForModule` hardcodes the single literal filename `app.plugin.js` with no extension probing at all. Consuming apps (AirHockey, Pong) failed `eas build --local` with `No "app.plugin.js" file found in @tastic/edge-guard` even though plain `expo prebuild` succeeded moments earlier — because prebuild-on-its-own used the newer project-local resolver, while `eas build --local` re-ran its own internal prebuild step through the older bundled one. `package.json` already declares `"type": "commonjs"`, so plain `.js` resolves identically to `.cjs` here — the rename costs nothing and is the only spelling every version of the resolver agrees on. Don't revert this without re-verifying against `eas-cli`'s actual bundled resolver, not just the project's own `node_modules`.

### How the hook and plugin connect

`useEdgeGestureGuard.ts` and `plugin/withEdgeGestureGuard.cjs` share a single string constant
(`EDGE_GUARD_USER_DEFAULTS_KEY` / `'tastic_deferEdgeGestures'`) as their only coupling: the hook
writes it via RN's `Settings.set`, which is a thin bridge onto `NSUserDefaults` on iOS, and the
plugin's swizzled getter reads it back with `UserDefaults.standard.bool(forKey:)`. No custom
native module. The plugin only patches `AppDelegate.swift` (throws if the file isn't Swift, or if
its expected anchors — the `ReactAppDependencyProvider` import and the `factory.startReactNative(...)`
call — aren't found, since that means the Expo template changed underneath it), so a native
rebuild (`expo prebuild` + a fresh build) is required after adding or removing the plugin.

## Public API

From `src/index.ts`:

- `EDGE_GUARD_USER_DEFAULTS_KEY` — the UserDefaults key (`'tastic_deferEdgeGestures'`) the config plugin reads
- `useEdgeGestureGuard(enabled: boolean): void` — mirrors `enabled` into native UserDefaults on iOS; no-op on every other platform

## Peer Dependencies

- `expo` >=54.0.0 — required for `expo/config-plugins`, used by `plugin/withEdgeGestureGuard.cjs` only (Node/prebuild-time, never bundled into the app)
- `react` >=19.0.0 — required
- `react-native` >=0.76.0 — required, for the `Platform`/`Settings` modules the hook uses

## Testing

- Framework: Jest (`@infinitetoken/jest-config/react-native`), jsdom environment
- Mock: `src/__mocks__/react-native.ts` mapped over the real `react-native` module in `jest.config.cjs`
- 4 tests in 1 suite (`useEdgeGestureGuard.test.ts`): mirrors `true`/`false` into `Settings.set`, re-syncs on `enabled` change, no-ops on non-iOS platforms
- 100% statements/branches/functions/lines on `useEdgeGestureGuard.ts` (the only file coverage is collected on — the preset's default `collectCoverageFrom` excludes `src/index.ts`), well clear of the preset's 70%×4 default threshold

## Code Style

Enforced by ESLint + Prettier, run `npm run lint` before finishing any task. `eslint.config.cjs` is
a bare `require('@infinitetoken/eslint-config/react-native')` — no local overrides.

**Prettier config:**
- Single quotes, JSX single quotes
- No semicolons
- No trailing commas
- Print width: 1000 (effectively disabled)

**ESLint rules (warnings unless noted):**
- `simple-import-sort/imports`, `simple-import-sort/exports` — imports and exports must be sorted
- `react-native/no-inline-styles` — no inline style objects
- `react-native/no-unused-styles` — no unused StyleSheet entries
- `react-native/no-raw-text` — off
- `no-console` — no console statements
- `@typescript-eslint/no-unused-vars` — `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern: '^_'` (unused vars/args/caught errors prefixed `_` are allowed)
- `@typescript-eslint/no-require-imports` — off
- `@typescript-eslint/no-explicit-any` — off inside `__tests__/`/`__mocks__/`
- `react-hooks/rules-of-hooks` — error, not a warning
- `react-hooks/exhaustive-deps`, `react-hooks/refs`, `react-hooks/immutability`, `react-hooks/preserve-manual-memoization`, `react-hooks/set-state-in-effect`
- `package-json/order-properties`, `package-json/sort-collections` — on `package.json` itself
