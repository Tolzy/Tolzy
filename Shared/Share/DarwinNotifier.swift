import Foundation

/// Cross-process signals between the app and its extensions.
///
/// Darwin notifications carry no data — just "something happened" — which is
/// all the listen flow needs; the payload itself travels through the App
/// Group inbox.
enum ListenSignal: String, CaseIterable {
    /// The broadcast extension started capturing.
    case started = "frenchlens.listen.started"
    /// The app asks the extension to stop and save.
    case stopRequested = "frenchlens.listen.stop"
    /// The extension saved what it heard to the inbox.
    case saved = "frenchlens.listen.saved"
    /// The extension ended without anything usable.
    case ended = "frenchlens.listen.ended"
}

final class DarwinNotifier {
    typealias Handler = (ListenSignal) -> Void

    private let handler: Handler
    private let signals: [ListenSignal]

    static func post(_ signal: ListenSignal) {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(signal.rawValue as CFString),
            nil, nil, true
        )
    }

    /// Calls `handler` on the main queue for each signal, until deallocated.
    init(observing signals: [ListenSignal], handler: @escaping Handler) {
        self.signals = signals
        self.handler = handler
        let observer = Unmanaged.passUnretained(self).toOpaque()
        for signal in signals {
            CFNotificationCenterAddObserver(
                CFNotificationCenterGetDarwinNotifyCenter(),
                observer,
                { _, observer, name, _, _ in
                    guard let observer, let raw = name?.rawValue as String?, let signal = ListenSignal(rawValue: raw) else { return }
                    let notifier = Unmanaged<DarwinNotifier>.fromOpaque(observer).takeUnretainedValue()
                    DispatchQueue.main.async { notifier.handler(signal) }
                },
                signal.rawValue as CFString,
                nil,
                .deliverImmediately
            )
        }
    }

    deinit {
        CFNotificationCenterRemoveEveryObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque()
        )
    }
}

/// Shared names for the listen flow.
enum ListenConstants {
    /// Bundle identifier suffix of the broadcast extension.
    static let extensionSuffix = ".Broadcast"
    /// Longest capture, in seconds. Reels are short; this bounds memory and analysis.
    static let maxDuration: Double = 180
    static let audioFileName = "listened.m4a"
    static let posterFileName = "poster.jpg"
    /// Written while listening so the app can show the elapsed time.
    static let activeMarkerName = "listening.json"
}
