import AVFoundation
import Observation
import Speech

/// Push-to-talk speech input in French: live words while you speak, the
/// final sentence when you stop. Recognition runs on the iPhone when the
/// French speech model is installed.
@MainActor
@Observable
final class SpeakInput {
    enum State: Equatable {
        case idle
        case starting
        case recording
        case finishing
    }

    private(set) var state: State = .idle
    /// What has been heard so far.
    private(set) var transcript = ""
    /// 0…1 microphone level, for the waveform.
    private(set) var level: Double = 0
    private(set) var errorMessage: String?

    @ObservationIgnored private var transcriber: MicTranscriber?

    var isRecording: Bool { state == .recording || state == .starting }

    func start() async {
        guard state == .idle else { return }
        errorMessage = nil
        transcript = ""
        level = 0
        state = .starting
        do {
            try await Self.ensurePermissions()
            let transcriber = try MicTranscriber(languageCode: "fr-FR")
            transcriber.onUpdate = { [weak self] text in
                Task { @MainActor in self?.transcript = text }
            }
            transcriber.onLevel = { [weak self] value in
                Task { @MainActor in
                    guard let self else { return }
                    // Rise fast, fall slowly, like a meter.
                    self.level = value > self.level ? value : self.level * 0.8 + value * 0.2
                }
            }
            try transcriber.start()
            self.transcriber = transcriber
            // Cancelled while starting (the learner let go).
            guard state == .starting else {
                transcriber.cancel()
                self.transcriber = nil
                return
            }
            state = .recording
        } catch {
            state = .idle
            errorMessage = Self.message(for: error)
        }
    }

    /// Stops listening and returns everything that was said.
    func finish() async -> String {
        guard let transcriber, state == .recording else {
            cancel()
            return ""
        }
        state = .finishing
        let text = await transcriber.finish()
        self.transcriber = nil
        state = .idle
        level = 0
        let final = text.isEmpty ? transcript : text
        transcript = ""
        return final.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func cancel() {
        transcriber?.cancel()
        transcriber = nil
        state = .idle
        transcript = ""
        level = 0
    }

    func clearError() { errorMessage = nil }

    // MARK: Permissions

    private static func ensurePermissions() async throws {
        try await SpeechTranscriptionService.ensureAuthorized()
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            return
        case .undetermined:
            guard await AVAudioApplication.requestRecordPermission() else { throw SpeakInputError.microphoneDenied }
        default:
            throw SpeakInputError.microphoneDenied
        }
    }

    private static func message(for error: Error) -> String {
        switch error {
        case SpeakInputError.microphoneDenied:
            "FrenchLens needs the microphone to hear you. Turn it on in Settings → FrenchLens."
        case AIServiceError.speechPermissionDenied:
            "FrenchLens needs Speech Recognition to understand you. Turn it on in Settings → FrenchLens."
        default:
            "The microphone isn't available right now. You can type instead."
        }
    }
}

enum SpeakInputError: Error {
    case microphoneDenied
    case recognizerUnavailable
}

/// The audio engine and recognition task. Not main-actor bound: the audio tap
/// runs on a real-time thread and only forwards buffers.
final class MicTranscriber: @unchecked Sendable {
    var onUpdate: (@Sendable (String) -> Void)?
    var onLevel: (@Sendable (Double) -> Void)?

    private let recognizer: SFSpeechRecognizer
    private let engine = AVAudioEngine()
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private var task: SFSpeechRecognitionTask?

    private let lock = NSLock()
    private var latest = ""
    private var finalContinuation: CheckedContinuation<String, Never>?
    private var isDone = false

    init(languageCode: String) throws {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: languageCode)), recognizer.isAvailable else {
            throw SpeakInputError.recognizerUnavailable
        }
        self.recognizer = recognizer
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.taskHint = .dictation
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
    }

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth, .duckOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw SpeakInputError.recognizerUnavailable }

        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            self.request.append(buffer)
            self.onLevel?(Self.level(of: buffer))
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                self.lock.withLock { self.latest = text }
                self.onUpdate?(text)
                if result.isFinal { self.complete() }
            }
            if error != nil { self.complete() }
        }

        engine.prepare()
        try engine.start()
    }

    /// Stops the microphone and waits (briefly) for the final words.
    func finish() async -> String {
        stopAudio()
        request.endAudio()
        return await withCheckedContinuation { continuation in
            let alreadyDone: Bool = lock.withLock {
                if isDone { return true }
                finalContinuation = continuation
                return false
            }
            if alreadyDone {
                continuation.resume(returning: lock.withLock { latest })
                return
            }
            // Never keep the learner waiting on a slow recognizer.
            DispatchQueue.global().asyncAfter(deadline: .now() + 1.5) { [weak self] in
                self?.complete()
            }
        }
    }

    func cancel() {
        stopAudio()
        task?.cancel()
        complete()
    }

    private func complete() {
        let (continuation, text): (CheckedContinuation<String, Never>?, String) = lock.withLock {
            isDone = true
            let continuation = finalContinuation
            finalContinuation = nil
            return (continuation, latest)
        }
        continuation?.resume(returning: text)
        if continuation != nil { task = nil }
    }

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// A perceptual 0…1 loudness for one buffer.
    private static func level(of buffer: AVAudioPCMBuffer) -> Double {
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        var sum: Float = 0
        for index in 0..<Int(buffer.frameLength) { sum += samples[index] * samples[index] }
        let rms = sqrt(sum / Float(buffer.frameLength))
        let decibels = 20 * log10(max(rms, 0.000_01))
        return Double(min(max((decibels + 50) / 45, 0), 1))
    }
}
