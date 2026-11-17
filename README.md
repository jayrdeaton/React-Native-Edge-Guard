# @tastic/edge-guard

An opt-in guard against the system's edge gestures firing over a full-screen or edge-anchored touch
control zone - the kind of zone a local-multiplayer arcade game's swipe-to-steer or swipe-to-aim
controls tend to use. Without it, a player's swipe that starts too close to a physical screen edge is
ambiguous between "steer the ship" and "leave the app" (or pull down Notification Center over it).
On iOS that's the top edge (Notification Center / Control Center) and the bottom (the home-indicator
swipe and, incidentally, Reachability); on Android, the bottom (home, recents), the sides (back) and
the top (the notification shade). Either way, with the guard on, the first swipe from an edge is held
and only a second, deliberate one goes through.

## What it does

### iOS

An Expo config plugin swizzles `UIViewController.preferredScreenEdgesDeferringSystemGestures` so
iOS defers its top- and bottom-edge system gestures to the app first. It doesn't disable those
gestures - the OS still honors a second, more deliberate swipe - it just stops light accidental
swipes near either edge from firing mid-gameplay.

The `useEdgeGestureGuard(enabled)` hook is the runtime half: it mirrors `enabled` into native
`UserDefaults` (via React Native's own built-in `Settings` bridge - no custom native module
required), which the plugin reads live and re-applies immediately on change, so flipping a settings
toggle mid-session takes effect without an app restart.

When the component that calls the hook unmounts, it writes `false` back, so you can call it from
just the screen that owns the touch zone instead of once for the app's lifetime: the guard doesn't
stay on for whatever mounts next, or across a later cold launch (`UserDefaults` persists). The
`UserDefaults` key is exported as `EDGE_GUARD_USER_DEFAULTS_KEY` (`'tastic_deferEdgeGestures'`), the
boolean the plugin reads, for native code or tests of your own that need the same value.

Deliberately **off by default** wherever you wire it to a persisted setting - this is meant to be
something a player opts into after actually hitting the "accidental swipe near an edge kicked me
out of the app" problem and gone looking for a fix, not a surprise "second swipe near the edge"
behavior every player gets from install.

The plugin only patches `AppDelegate.swift`, and the hook no-ops on every other platform.

### Android

Android has no way to defer its edge gestures. What it has is sticky immersive mode: with the system
bars hidden and set to come back only transiently on a swipe, a swipe from the bottom, either side or
the top just brings the bars back for a moment, and only a second swipe goes home, goes back or pulls
down the shade. `edgeGuardScreenOptions(enabled)` returns the screen options that do that through
react-native-screens (and so expo-router's and React Navigation's native stacks):
`{ navigationBarHidden: true, statusBarHidden: true }` while enabled, `{ navigationBarHidden: false }`
while not (a screen's own `statusBarHidden` stands), and `{}` on every other platform.
react-native-screens sets `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` when it hides the navigation bar,
and puts the bar back when the screen stops being the top one.

They're screen options for the screen that owns the touch zone, not a live toggle, because hiding a
bar changes the safe area: switching it every time a round starts or pauses would resize anything laid
out from the insets mid-match. As a screen option the bars go once, as the screen opens, and stay gone
until the player leaves it. No native code, so no config plugin and no native build for this half.

## Usage

**app.json**

```json
{
  "expo": {
    "plugins": ["@tastic/edge-guard"]
  }
}
```

**In your settings-backed state (iOS):**

```tsx
import { useEdgeGestureGuard } from '@tastic/edge-guard'

function App({ settings }: { settings: { deferEdgeGestures: boolean } }) {
  useEdgeGestureGuard(settings.deferEdgeGestures)
  // ...
}
```

**On the play screen's options (Android), spread after its own:**

```tsx
import { edgeGuardScreenOptions } from '@tastic/edge-guard'

<Stack.Screen name='game' options={{ statusBarHidden: true, ...edgeGuardScreenOptions(settings.deferEdgeGestures) }} />
```

On 3-button navigation the buttons are hidden on that screen while the guard is on; a swipe from the
bottom brings them back for a moment.

The iOS plugin requires a native rebuild (`expo prebuild` + a fresh build) after adding or removing
it: plain JS/OTA reloads won't pick up an AppDelegate.swift change. Android's half needs no rebuild.

The plugin is the package's `./app.plugin.js` entry, which Expo finds from the bare package name
above, and takes no options. It stops `expo prebuild` with an error, rather than skipping the patch,
when `AppDelegate` isn't Swift or lacks the lines it anchors to (a changed Expo template), and
running it again on an already-patched `AppDelegate.swift` changes nothing.

## Peer dependencies

`expo` (>=54.0.0) - for `expo/config-plugins`, used by the plugin only (Node/prebuild-time, never
bundled into the app). `react` (>=19.0.0) and `react-native` (>=0.76.0) for the hook and
`edgeGuardScreenOptions`.

---

Made by [Infinite Token](https://www.infinitetoken.com), the team behind [Lumber](https://lumber.infinitetoken.com): end-to-end encrypted logging.
