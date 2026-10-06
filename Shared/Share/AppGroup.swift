import Foundation

/// The App Group shared by the app and the Share Extension.
enum AppGroup {
    /// Read from Info.plist (`FLAppGroupIdentifier`, set from `FRENCHLENS_APP_GROUP`).
    static var identifier: String {
        (Bundle.main.object(forInfoDictionaryKey: "FLAppGroupIdentifier") as? String)
            .flatMap { $0.isEmpty || $0.contains("$(") ? nil : $0 }
            ?? "group.com.tolzy.frenchlens"
    }

    /// `nil` when the entitlement is missing (e.g. unsigned builds).
    static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }
}
