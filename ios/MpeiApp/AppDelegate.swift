import UIKit

class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Process-wide setup must finish before SceneDelegate mounts React Native.
    YandexMapsInitializer.shared.initialize()

    return true
  }
}
