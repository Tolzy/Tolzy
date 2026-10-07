import Foundation
import Observation
import UIKit

/// The app's view of a "Listen while you watch" capture, which runs in the
/// broadcast extension. Driven by Darwin signals from the extension, with
/// the screen-capture flag and an inbox marker as fallbacks.
@MainActor
@Observable
final class ListenSession {
    enum Phase: Equatable {
        case idle
        /// The learner tapped Start; waiting for iOS's broadcast sheet.
        case starting
        case listening(since: Date)
        /// Asked the extension to stop and save.
        case stopping
    }

    private(set) var phase: Phase = .idle

    /// Called when the extension has saved what it heard.
    @ObservationIgnored var onSaved: (() -> Void)?

    @ObservationIgnored private let inbox: ShareInbox?
    @ObservationIgnored private var notifier: DarwinNotifier?
    @ObservationIgnored private var captureObserver: NSObjectProtocol?
    @ObservationIgnored private var timeoutTask: Task<Void, Never>?

    init(inbox: ShareInbox?) {
        self.inbox = inbox
        notifier = DarwinNotifier(observing: [.started, .saved, .ended]) { [weak self] signal in
            self?.handle(signal)
        }
        captureObserver = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            let captured = (note.object as? UIScreen)?.isCaptured ?? false
            MainActor.assumeIsolated { self?.captureChanged(captured) }
        }
        refresh()
    }

    var isActive: Bool { phase != .idle }

    /// The learner tapped Start listening (the system sheet is opening).
    func markStarting() {
        phase = .starting
        timeoutTask?.cancel()
        timeoutTask = Task { [weak self] in
            // If the learner cancels the system sheet, nothing is signalled.
            try? await Task.sleep(for: .seconds(20))
            guard let self, self.phase == .starting else { return }
            self.phase = .idle
        }
    }

    /// "Build my lesson": the extension finishes the file and stops itself.
    func requestStop() {
        guard case .listening = phase else { return }
        phase = .stopping
        DarwinNotifier.post(.stopRequested)
        timeoutTask?.cancel()
        timeoutTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(8))
            guard let self, self.phase == .stopping else { return }
            // No reply: pick up whatever the inbox has.
            self.phase = .idle
            self.onSaved?()
        }
    }

    /// Re-syncs with the extension (e.g. when the app returns to the foreground).
    func refresh() {
        if let startedAt = activeMarkerDate() {
            if case .listening = phase { return }
            if phase != .stopping { phase = .listening(since: startedAt) }
        } else if case .listening = phase {
            phase = .idle
        }
    }

    // MARK: Signals

    private func handle(_ signal: ListenSignal) {
        switch signal {
        case .started:
            timeoutTask?.cancel()
            phase = .listening(since: activeMarkerDate() ?? Date())
        case .saved:
            timeoutTask?.cancel()
            phase = .idle
            onSaved?()
        case .ended:
            timeoutTask?.cancel()
            phase = .idle
        case .stopRequested:
            break
        }
    }

    private func captureChanged(_ captured: Bool) {
        if captured, phase == .starting {
            phase = .listening(since: activeMarkerDate() ?? Date())
        }
    }

    private func activeMarkerDate() -> Date? {
        guard let url = inbox?.rootURL.appendingPathComponent(ListenConstants.activeMarkerName),
              let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Double],
              let started = object["startedAt"]
        else { return nil }
        let date = Date(timeIntervalSince1970: started)
        // A stale marker (e.g. the extension was killed) doesn't count.
        return Date().timeIntervalSince(date) < ListenConstants.maxDuration + 120 ? date : nil
    }
}
