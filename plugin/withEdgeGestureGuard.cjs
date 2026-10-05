const { withAppDelegate } = require('expo/config-plugins')

// Swizzles UIViewController.preferredScreenEdgesDeferringSystemGestures so the system defers its
// top- and bottom-edge system gestures (Notification Center / Control Center at the top;
// Reachability and the home-indicator swipe at the bottom) to the app first, whenever the player
// has opted into that — see src/useEdgeGestureGuard.ts, which mirrors the setting into
// UserDefaults under the key read below. Doesn't disable those gestures — the OS still honors a
// second, more deliberate swipe — but stops light accidental swipes near either edge from firing
// over a full-screen or edge-anchored touch control zone mid-gameplay.
//
// This is done via swizzling rather than wrapping the root view controller since a second wrapper
// installed on top of whatever's already there risks tripping UIKit's "already a window's root
// view controller" check. Swizzling the base class getter works regardless of which concrete
// class ends up as the root view controller.
const SWIZZLE_SWIFT = `
private let tastic_edgeGuardSwizzle: Void = {
  let cls = UIViewController.self
  guard
    let original = class_getInstanceMethod(cls, #selector(getter: UIViewController.preferredScreenEdgesDeferringSystemGestures)),
    let replacement = class_getInstanceMethod(cls, #selector(UIViewController.tastic_preferredScreenEdgesDeferringSystemGestures))
  else { return }
  method_exchangeImplementations(original, replacement)

  // UIKit only re-reads this getter on its own schedule (view controller transitions, foreground,
  // etc.), so without this a toggle flipped mid-session wouldn't take effect until then. UserDefaults
  // posts didChangeNotification on every write, including the one from the JS Settings bridge, so
  // this nudges every window's root view controller to re-query right away.
  NotificationCenter.default.addObserver(forName: UserDefaults.didChangeNotification, object: nil, queue: .main) { _ in
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      for window in windowScene.windows {
        window.rootViewController?.setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
      }
    }
  }
}()

extension UIViewController {
  @objc func tastic_preferredScreenEdgesDeferringSystemGestures() -> UIRectEdge {
    UserDefaults.standard.bool(forKey: "tastic_deferEdgeGestures") ? .all : []
  }
}
`

const IMPORT_ANCHOR = 'import ReactAppDependencyProvider'

// The swizzle call goes right before didFinishLaunching's closing `return super.application(...)`,
// which both of Expo's AppDelegate layouts still have: the window-based one (SDK 57 and earlier),
// where AppDelegate creates the window and calls factory.startReactNative(...) itself, and the
// scene-based one iOS 27 requires (SDK 58's template, or SDK 57 with expo-build-properties'
// ios.enableSceneSupport), where Expo's scene delegate (ExpoAppSceneDelegate, which SDK 58's
// SceneDelegate subclasses) does both instead and neither appears in AppDelegate at all.
// didFinishLaunching still runs before any scene connects, and the swizzle is on the base
// UIViewController class, so it also covers the root view controller the scene delegate creates.
const DID_FINISH_LAUNCHING_RETURN_ANCHOR = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)'

const MARKER = 'tastic_edgeGuardSwizzle'

function withEdgeGestureGuard(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(`withEdgeGestureGuard expects AppDelegate.swift, got language "${config.modResults.language}". ` + 'The Expo template likely changed — update this plugin to match.')
    }

    let contents = config.modResults.contents

    if (contents.includes(MARKER)) {
      return config
    }

    const missingAnchor = [IMPORT_ANCHOR, DID_FINISH_LAUNCHING_RETURN_ANCHOR].find((anchor) => !contents.includes(anchor))
    if (missingAnchor) {
      throw new Error(`withEdgeGestureGuard could not find \`${missingAnchor.trim()}\` in AppDelegate.swift. ` + 'The Expo template likely changed — update this plugin to match.')
    }

    contents = contents.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport ObjectiveC`)
    contents = contents.replace(DID_FINISH_LAUNCHING_RETURN_ANCHOR, `    _ = tastic_edgeGuardSwizzle\n${DID_FINISH_LAUNCHING_RETURN_ANCHOR}`)
    contents += SWIZZLE_SWIFT

    config.modResults.contents = contents
    return config
  })
}

module.exports = withEdgeGestureGuard
