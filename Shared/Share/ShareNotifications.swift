import Foundation
import UserNotifications

/// Apple-supported hand-off from the Share Extension to the app.
///
/// Share extensions cannot launch their containing app. Instead the payload is
/// queued in the App Group and, if the learner allowed notifications, a local
/// notification offers a one-tap route into FrenchLens. The app also drains the
/// inbox every time it becomes active, so nothing depends on the notification.
enum ShareNotifications {
    static let deepLinkKey = "deepLink"
    static let categoryIdentifier = "frenchlens.share.ready"

    static func postReady(payloadID: UUID, summary: String) async {
        await post(
            payloadID: payloadID,
            title: "Ready to learn",
            body: "\(summary) received. Tap to open your lesson in FrenchLens."
        )
    }

    /// After "Listen while you watch" stops from the status bar.
    static func postListened(payloadID: UUID) async {
        await post(
            payloadID: payloadID,
            title: "Got it",
            body: "FrenchLens heard the French. Tap to build your lesson."
        )
    }

    private static func post(payloadID: UUID, title: String, body: String) async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.categoryIdentifier = categoryIdentifier
        content.userInfo = [deepLinkKey: DeepLink.ingest(payloadID).url.absoluteString]
        content.threadIdentifier = "frenchlens.share"

        let request = UNNotificationRequest(identifier: payloadID.uuidString, content: content, trigger: nil)
        try? await center.add(request)
    }

    static func deepLink(from userInfo: [AnyHashable: Any]) -> DeepLink? {
        (userInfo[deepLinkKey] as? String).flatMap(URL.init(string:)).flatMap(DeepLink.init(url:))
    }
}
