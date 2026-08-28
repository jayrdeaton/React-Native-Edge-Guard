const { withAppDelegate } = require('expo/config-plugins')

// Swizzles UIViewController.preferredScreenEdgesDeferringSystemGestures so the system defers the
// bottom-edge system gesture (Reachability, and incidentally the home-indicator swipe) to the app
// first, whenever the player has opted into that — see src/useEdgeGestureGuard.ts, which mirrors
// the setting into UserDefaults under the key read below. Doesn't disable the gesture — the OS
// still honors a second, more deliberate swipe — but stops light accidental swipes near the
// bottom edge from firing over a full-screen or bottom-anchored touch control zone mid-gameplay.
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
    UserDefaults.standard.bool(forKey: "tastic_deferBottomEdgeGestures") ? .bottom : []
  }
}
`

const IMPORT_ANCHOR = 'import ReactAppDependencyProvider'

const START_REACT_NATIVE_ANCHOR = `    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)`

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

    if (!contents.includes(IMPORT_ANCHOR) || !contents.includes(START_REACT_NATIVE_ANCHOR)) {
      throw new Error('withEdgeGestureGuard could not find the expected imports or factory.startReactNative(...) ' + 'call in AppDelegate.swift. The Expo template likely changed — update this plugin to match.')
    }

    contents = contents.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport ObjectiveC`)
    contents = contents.replace(START_REACT_NATIVE_ANCHOR, `${START_REACT_NATIVE_ANCHOR}\n    _ = tastic_edgeGuardSwizzle`)
    contents += SWIZZLE_SWIFT

    config.modResults.contents = contents
    return config
  })
}

module.exports = withEdgeGestureGuard
