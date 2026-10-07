import Foundation
import Speech

/// Apple speech recognition in French. Runs on the iPhone when the French
/// on-device model is installed; otherwise Apple's speech service is used.
final class SpeechTranscriptionService: TranscriptionService {
    func transcribe(audioAt url: URL, languageCode: String) async throws -> TranscriptionResult {
        try await Self.ensureAuthorized()

        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: languageCode)), recognizer.isAvailable else {
            throw AIServiceError.speechUnavailable
        }

        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true
        request.taskHint = .dictation
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let (formatted, words) = try await recognize(request, with: recognizer)
        guard !formatted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIServiceError.noSpeech
        }
        return TranscriptionResult(
            text: formatted,
            languageCode: languageCode,
            segments: SentenceSplitter.split(formatted: formatted, words: words)
        )
    }

    static func ensureAuthorized() async throws {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            return
        case .notDetermined:
            let status = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
            }
            guard status == .authorized else { throw AIServiceError.speechPermissionDenied }
        default:
            throw AIServiceError.speechPermissionDenied
        }
    }

    private func recognize(
        _ request: SFSpeechURLRecognitionRequest,
        with recognizer: SFSpeechRecognizer
    ) async throws -> (String, [SentenceSplitter.Word]) {
        let box = RecognitionBox()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                box.start(continuation) {
                    recognizer.recognitionTask(with: request) { result, error in
                        if let result, result.isFinal {
                            let transcription = result.bestTranscription
                            let words = transcription.segments.map {
                                SentenceSplitter.Word(text: $0.substring, start: $0.timestamp, duration: $0.duration)
                            }
                            box.finish(.success((transcription.formattedString, words)))
                        } else if let error {
                            box.finish(.failure(Self.map(error)))
                        }
                    }
                }
            }
        } onCancel: {
            box.cancel()
        }
    }

    /// 1110 = "No speech detected" (kAFAssistantErrorDomain).
    private static func map(_ error: Error) -> Error {
        let code = (error as NSError).code
        if code == 1110 || code == 203 { return AIServiceError.noSpeech }
        return AIServiceError.speechUnavailable
    }
}

/// Resumes the continuation exactly once and keeps the task alive.
private final class RecognitionBox: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<(String, [SentenceSplitter.Word]), Error>?
    private var task: SFSpeechRecognitionTask?

    func start(
        _ continuation: CheckedContinuation<(String, [SentenceSplitter.Word]), Error>,
        makeTask: () -> SFSpeechRecognitionTask
    ) {
        lock.lock()
        self.continuation = continuation
        lock.unlock()
        let task = makeTask()
        lock.lock()
        self.task = task
        lock.unlock()
    }

    func finish(_ result: Result<(String, [SentenceSplitter.Word]), Error>) {
        lock.lock()
        let continuation = self.continuation
        self.continuation = nil
        lock.unlock()
        continuation?.resume(with: result)
    }

    func cancel() {
        lock.lock()
        let task = self.task
        lock.unlock()
        task?.cancel()
        finish(.failure(CancellationError()))
    }
}
