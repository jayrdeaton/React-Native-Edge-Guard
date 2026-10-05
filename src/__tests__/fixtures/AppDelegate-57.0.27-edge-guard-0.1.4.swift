// Test fixture: the expo-template-bare-minimum@57.0.27 AppDelegate.swift after @tastic/edge-guard
// 0.1.4's plugin, unmodified below this header — the swizzle call still sits right after
// factory.startReactNative(...), where 0.1.4 anchored it. Byte-identical to the AppDelegate.swift
// `expo prebuild` generated for the consuming games at that version.

internal import Expo
import React
import ReactAppDependencyProvider
import ObjectiveC

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    _ = tastic_edgeGuardSwizzle
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

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
