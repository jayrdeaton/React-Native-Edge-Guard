import { Platform } from 'react-native'

// The two screen options react-native-screens (and so expo-router's and React Navigation's native
// stacks) read on Android. Typed here rather than imported so this package doesn't take on either
// navigator as a dependency.
export interface EdgeGuardScreenOptions {
  navigationBarHidden?: boolean
  statusBarHidden?: boolean
}

/**
 * Android's half of Edge Guard: screen options for the screen that owns the touch zone being
 * protected (a play screen), spread after that screen's own options.
 *
 * Android has no way to defer its edge gestures the way iOS does. What it has is sticky immersive
 * mode: with the system bars hidden and set to come back only transiently on a swipe, a swipe from
 * the bottom edge, either side edge or the top just brings the bars back for a moment, and only a
 * second swipe goes home, goes back or pulls down the notification shade. react-native-screens does
 * exactly that for a screen with `navigationBarHidden` (it hides the bar and sets
 * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE, which covers a hidden status bar too), and restores the bar
 * when that screen stops being the top one. `statusBarHidden` brings the top edge in for a screen
 * that would otherwise keep its status bar.
 *
 * Screen options rather than a live toggle, because hiding a bar changes the safe area: switching it
 * every time a round starts or pauses would resize anything laid out from the insets mid-match. As a
 * screen option the bars go once, as the screen opens, the same way a play screen's hidden status bar
 * already does, and stay gone until the player leaves it (paused or between rounds too).
 *
 * When `enabled` is false on Android, only `navigationBarHidden: false` comes back, so a screen's own
 * `statusBarHidden` stands. An empty object everywhere else: iOS's half is useEdgeGestureGuard.
 */
export function edgeGuardScreenOptions(enabled: boolean): EdgeGuardScreenOptions {
  if (Platform.OS !== 'android') return {}
  return enabled ? { navigationBarHidden: true, statusBarHidden: true } : { navigationBarHidden: false }
}
