import Foundation
import Observation

/// What voice mode needs from the microphone. `SpeakInput` in the app; a
/// fake in tests.
@MainActor
protocol VoiceListening: AnyObject {
    var transcript: String { get }
    var level: Double { get }
    var errorMessage: String? { get }
    var lastChange: Date { get }
    var recognizerEnded: Bool { get }
    func start() async
    func finish() async -> String
    func cancel()
}

/// Hands-free conversation, like a phone call: listen → (pause) → think →
/// speak → listen… The microphone is off while Camille speaks, so she never
/// hears herself. Tap the orb to send early or to interrupt her.
@MainActor
@Observable
final class VoiceSession {
    enum Phase: Equatable {
        case connecting
        case listening
        case thinking
        case speaking
        case muted
        case failed(String)
    }

    private(set) var phase: Phase = .connecting
    private(set) var isMuted = false

    let controller: ConversationController
    @ObservationIgnored let listener: VoiceListening
    @ObservationIgnored private var loop: Task<Void, Never>?
    @ObservationIgnored private var sendNow = false
    /// Bumped on every mute, so a listening turn notices even a quick mute/unmute.
    @ObservationIgnored private var muteGeneration = 0
    @ObservationIgnored private var savedAutoSpeak = true
    /// Whether to drive the microphone (off in UI tests and previews).
    @ObservationIgnored private let usesMicrophone: Bool

    /// How long a pause ends the learner's turn. Learners pause to think,
    /// so this is a little longer than a native-speaker endpoint.
    nonisolated static let endOfTurnSilence: TimeInterval = 1.4
    @ObservationIgnored var pollInterval: Duration = .milliseconds(120)

    init(controller: ConversationController, listener: VoiceListening, usesMicrophone: Bool = true) {
        self.controller = controller
        self.listener = listener
        self.usesMicrophone = usesMicrophone
    }

    /// What's being said right now, for the captions.
    var caption: String {
        switch phase {
        case .listening: controller.repairingName(in: listener.transcript)
        case .speaking: controller.messages.last(where: { $0.role == .tutor })?.text ?? ""
        case .thinking:
            // Camille's reply as it's written, or what the learner just said.
            controller.messages.last.map { $0.text.isEmpty ? (controller.messages.last(where: { $0.role == .learner })?.text ?? "") : $0.text } ?? ""
        default: ""
        }
    }

    var englishCaption: String {
        guard phase == .speaking else { return "" }
        return controller.messages.last(where: { $0.role == .tutor })?.english ?? ""
    }

    /// 0…1, drives the orb.
    var inputLevel: Double { phase == .listening ? listener.level : 0 }

    func start() {
        guard loop == nil else { return }
        savedAutoSpeak = controller.autoSpeak
        controller.autoSpeak = true
        loop = Task { [weak self] in await self?.run() }
    }

    func end() {
        loop?.cancel()
        loop = nil
        listener.cancel()
        controller.tts.stop()
        controller.autoSpeak = savedAutoSpeak
    }

    /// After a failure: try the last reply again, or the microphone.
    func retry() {
        loop?.cancel()
        phase = .connecting
        if controller.errorMessage != nil { controller.retry() }
        loop = Task { [weak self] in await self?.run() }
    }

    func toggleMute() {
        isMuted.toggle()
        if isMuted {
            muteGeneration += 1
            listener.cancel()
            if phase == .listening { phase = .muted }
        } else if phase == .muted {
            phase = .connecting
        }
    }

    /// Tap on the orb: send what was said now, or stop Camille talking.
    func tap() {
        switch phase {
        case .listening where !listener.transcript.isEmpty: sendNow = true
        case .speaking: controller.tts.stop()
        default: break
        }
    }

    /// Ends the learner's turn after a pause in what's being heard.
    nonisolated static func shouldEndTurn(transcript: String, lastChange: Date, now: Date, silence: TimeInterval? = nil) -> Bool {
        guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        let needed = silence ?? ConversationFlow.silenceNeeded(after: transcript, base: endOfTurnSilence)
        return now.timeIntervalSince(lastChange) >= needed
    }

    // MARK: The loop

    private func run() async {
        // Let Camille open (or finish what she's writing) first.
        if controller.messages.isEmpty { controller.start() }
        if controller.isResponding {
            phase = .thinking
            await controller.waitForReply()
        }

        while !Task.isCancelled {
            await waitWhileSpeaking()
            if Task.isCancelled { return }

            if let error = controller.errorMessage {
                phase = .failed(error)
                return
            }
            if isMuted {
                phase = .muted
                await waitUntilUnmuted()
                continue
            }
            guard usesMicrophone else {
                phase = .listening
                await waitUntilCancelled()
                return
            }

            guard let heard = await listenForTurn() else {
                if case .failed = phase { return }
                // Nothing heard: breathe before listening again.
                try? await Task.sleep(for: pollInterval * 3)
                continue
            }
            phase = .thinking
            controller.send(heard)
            await controller.waitForReply()
        }
    }

    private func waitWhileSpeaking() async {
        guard controller.tts.current != nil else { return }
        phase = .speaking
        while !Task.isCancelled, controller.tts.current != nil {
            try? await Task.sleep(for: pollInterval)
        }
    }

    private func waitUntilUnmuted() async {
        while !Task.isCancelled, isMuted {
            try? await Task.sleep(for: pollInterval)
        }
    }

    private func waitUntilCancelled() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(500))
        }
    }

    /// Listens until the learner pauses. Nil when muted, cancelled or failed.
    private func listenForTurn() async -> String? {
        sendNow = false
        let generation = muteGeneration
        phase = .listening
        await listener.start()
        if let error = listener.errorMessage {
            phase = .failed(error)
            return nil
        }

        while !Task.isCancelled {
            try? await Task.sleep(for: pollInterval)
            if isMuted || generation != muteGeneration {
                listener.cancel()
                return nil
            }
            if listener.recognizerEnded {
                // Recognition stops by itself after about a minute.
                let text = await listener.finish()
                return text.isEmpty ? nil : text
            }
            if sendNow || Self.shouldEndTurn(transcript: listener.transcript, lastChange: listener.lastChange, now: Date()) {
                let text = await listener.finish()
                return text.isEmpty ? nil : text
            }
        }
        listener.cancel()
        return nil
    }
}
