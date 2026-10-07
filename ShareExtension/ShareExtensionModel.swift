import Foundation
import Observation

@MainActor
@Observable
final class ShareExtensionModel {
    enum Phase: Equatable {
        case detecting
        /// Queued for the app. `resolved` is the input the app will use.
        case ready(summary: String, resolved: SharedCapability?, link: URL?)
        case failed(String)
    }

    private(set) var phase: Phase = .detecting
    @ObservationIgnored private var payloadID: UUID?

    /// Minimum time on the "Understanding your French…" state, so it reads as
    /// a moment rather than a flash.
    private let minimumDetectionTime: Duration = .milliseconds(900)

    func receive(from context: NSExtensionContext?) async {
        let started = ContinuousClock.now

        guard let context else {
            phase = .failed("FrenchLens didn't receive anything to read.")
            return
        }
        guard let inbox = ShareInbox.appGroup() else {
            phase = .failed("FrenchLens couldn't reach its shared storage. Check that the App Group is enabled for the app and the extension.")
            return
        }

        let items = context.inputItems.compactMap { $0 as? NSExtensionItem }
        let attachments: [NSItemProvider] = items.flatMap { $0.attachments ?? [] }
        let providers: [ItemProviding] = attachments
        let contentTexts = items.compactMap { $0.attributedContentText?.string }

        let id = UUID()
        payloadID = id
        do {
            let directory = try inbox.makeDirectory(for: id)
            let parser = ShareItemParser(payloadID: id, directory: directory)
            let payload = await parser.parse(providers: providers, contentTexts: contentTexts)

            let elapsed = ContinuousClock.now - started
            if elapsed < minimumDetectionTime {
                try? await Task.sleep(for: minimumDetectionTime - elapsed)
            }

            guard !payload.isEmpty else {
                inbox.remove(id: id)
                phase = .failed("This app didn't share a video, link or text that FrenchLens can read.")
                return
            }

            try inbox.save(payload)
            await ShareNotifications.postReady(payloadID: id, summary: payload.summary)

            let resolved = ContentResolver().resolve(payload)
            phase = .ready(summary: payload.summary, resolved: resolved.capability, link: resolved.link)
        } catch {
            inbox.remove(id: id)
            phase = .failed("Something went wrong while saving what you shared.")
        }
    }

    /// Removes a queued payload when the learner cancels.
    func discard() {
        guard let payloadID, let inbox = ShareInbox.appGroup() else { return }
        inbox.remove(id: payloadID)
    }
}
