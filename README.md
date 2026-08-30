# @tastic/edge-guard

An opt-in guard against iOS's top- and bottom-edge system gestures (Notification Center / Control
Center at the top; the home-indicator swipe and, incidentally, Reachability at the bottom) firing
over a full-screen or edge-anchored touch control zone — the kind of zone a local-multiplayer
arcade game's swipe-to-steer or swipe-to-aim controls tend to use. Without it, a player's swipe
that starts too close to a physical screen edge is ambiguous between "steer the ship" and "leave
the app" (or pull down Notification Center over it).

## What it does

An Expo config plugin swizzles `UIViewController.preferredScreenEdgesDeferringSystemGestures` so
iOS defers its top- and bottom-edge system gestures to the app first. It doesn't disable those
gestures — the OS still honors a second, more deliberate swipe — it just stops light accidental
swipes near either edge from firing mid-gameplay.

The `useEdgeGestureGuard(enabled)` hook is the runtime half: it mirrors `enabled` into native
`UserDefaults` (via React Native's own built-in `Settings` bridge — no custom native module
required), which the plugin reads live and re-applies immediately on change, so flipping a settings
toggle mid-session takes effect without an app restart.

Deliberately **off by default** wherever you wire it to a persisted setting — this is meant to be
something a player opts into after actually hitting the "accidental swipe near an edge kicked me
out of the app" problem and gone looking for a fix, not a surprise "second swipe near the edge"
behavior every player gets from install.

iOS only. The plugin only patches `AppDelegate.swift`, and the hook no-ops on every other platform.

## Usage

**app.json**

```json
{
  "expo": {
    "plugins": ["@tastic/edge-guard"]
  }
}
```

**In your settings-backed state:**

```tsx
import { useEdgeGestureGuard } from '@tastic/edge-guard'

function App({ settings }: { settings: { deferEdgeGestures: boolean } }) {
  useEdgeGestureGuard(settings.deferEdgeGestures)
  // ...
}
```

Requires a native rebuild (`expo prebuild` + a fresh build) after adding or removing the plugin —
plain JS/OTA reloads won't pick up an AppDelegate.swift change.

## Install (local dev via yalc)

Not published to the public npm registry yet.

```bash
cd react-native-edge-guard
npm run build
yalc publish

cd ../your-game
yalc add @tastic/edge-guard
npm install
```

## Peer dependencies

`expo` (>=54.0.0) — for `expo/config-plugins`, used by the plugin only (Node/prebuild-time, never
bundled into the app). `react` (>=19.0.0) and `react-native` (>=0.76.0) for the hook.
