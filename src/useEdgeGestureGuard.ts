import { useEffect } from 'react'
import { Platform, Settings } from 'react-native'

// Key this package's Expo config plugin reads via UserDefaults.standard.bool(forKey:) — see
// plugin/withEdgeGestureGuard.cjs. react-native's built-in Settings module is a thin bridge
// straight onto NSUserDefaults on iOS, so this constant plus the effect below is the entire
// JS-to-native handoff: no custom native module required.
export const EDGE_GUARD_USER_DEFAULTS_KEY = 'tastic_deferEdgeGestures'

/**
 * Mirrors `enabled` into native UserDefaults so this package's config plugin — which swizzles
 * UIViewController.preferredScreenEdgesDeferringSystemGestures — can read it live and defer iOS's
 * top- and bottom-edge system gestures (Notification Center / Control Center at the top;
 * Reachability and the home-indicator swipe at the bottom) while it's on. Doesn't disable those
 * gestures, just requires a second, more deliberate swipe near the edge, so accidental swipes from
 * a full-screen or edge-anchored touch control zone don't kick the player out of the app.
 *
 * iOS only. On every other platform react-native's fallback Settings module just warns and
 * no-ops, so this skips the call entirely there rather than spamming that warning.
 */
export function useEdgeGestureGuard(enabled: boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    Settings.set({ [EDGE_GUARD_USER_DEFAULTS_KEY]: enabled })
  }, [enabled])
}
