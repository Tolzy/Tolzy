import ReplayKit

/// Principal class of "Listen while you watch" (a ReplayKit broadcast upload
/// extension). The learner starts it, plays a Reel in any app, and stops it.
/// Only the app audio is kept — never the screen — plus one small still
/// frame for the lesson's poster. Everything stays on the iPhone.
final class SampleHandler: RPBroadcastSampleHandler {
    private var recording: ListenRecording?
    private var stopObserver: DarwinNotifier?
    private let lock = NSLock()
    private var finished = false
    private var limitReached = false

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        guard let inbox = ShareInbox.appGroup() else {
            finishBroadcastWithError(Self.error("FrenchLens couldn't reach its shared storage."))
            return
        }
        do {
            recording = try ListenRecording(inbox: inbox)
        } catch {
            finishBroadcastWithError(Self.error("FrenchLens couldn't start listening."))
            return
        }
        // "Build my lesson" in the app stops the capture from here.
        stopObserver = DarwinNotifier(observing: [.stopRequested]) { [weak self] _ in
            self?.stopFromApp()
        }
        DarwinNotifier.post(.started)
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard let recording else { return }
        switch sampleBufferType {
        case .audioApp:
            recording.appendAudio(sampleBuffer)
            if recording.duration >= ListenConstants.maxDuration, markLimitReached() {
                DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                    self?.complete(notify: true)
                    self?.finishBroadcastWithError(Self.error("FrenchLens listened for 3 minutes, its limit. Your lesson is ready to build."))
                }
            }
        case .video:
            recording.capturePosterIfNeeded(sampleBuffer)
        default:
            break
        }
    }

    override func broadcastFinished() {
        // Stopped from the status bar or Control Center.
        complete(notify: true)
    }

    private func markLimitReached() -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard !limitReached else { return false }
        limitReached = true
        return true
    }

    private func stopFromApp() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            self.complete(notify: false)
            // The system shows this as the reason the broadcast ended.
            self.finishBroadcastWithError(Self.error("FrenchLens has the audio. Building your lesson…"))
        }
    }

    /// Saves once, whichever way the broadcast ends.
    private func complete(notify: Bool) {
        lock.lock()
        guard !finished, let recording else {
            lock.unlock()
            return
        }
        finished = true
        lock.unlock()
        let payload = recording.finish()
        if let payload {
            DarwinNotifier.post(.saved)
            if notify {
                let semaphore = DispatchSemaphore(value: 0)
                Task {
                    await ShareNotifications.postListened(payloadID: payload.id)
                    semaphore.signal()
                }
                _ = semaphore.wait(timeout: .now() + 2)
            }
        } else {
            DarwinNotifier.post(.ended)
        }
    }

    private static func error(_ message: String) -> NSError {
        NSError(domain: "FrenchLens.Listen", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
