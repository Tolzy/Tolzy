import UIKit
import UserNotifications

/// Routes taps on "Ready to learn" notifications posted by the Share Extension.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let link = ShareNotifications.deepLink(from: response.notification.request.content.userInfo)
        DispatchQueue.main.async {
            // Re-enters through `.onOpenURL`, the single routing entry point.
            if let link { UIApplication.shared.open(link.url) }
            completionHandler()
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // The app is already open and will pick the share up itself.
        completionHandler([])
    }
}
