import AVFoundation
import Foundation
import Speech

/// iOS 26's long-form speech recognition (SpeechAnalyzer + SpeechTranscriber).
/// More accurate than SFSpeechRecognizer on real-world video — music, fast
/// speech, long clips — and fully on device. The French model is downloaded
/// the first time it's needed.
@available(iOS 26.0, *)
struct SpeechAnalyzerTranscriptionService: TranscriptionService {
    static func supportedLocale(for languageCode: String) async -> Locale? {
        guard SpeechTranscriber.isAvailable else { return nil }
        return await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: languageCode))
    }

    func transcribe(audioAt url: URL, languageCode: String) async throws -> TranscriptionResult {
        guard let locale = await Self.supportedLocale(for: languageCode) else {
            throw AIServiceError.speechUnavailable
        }

        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [],
            attributeOptions: []
        )
        if let installation = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await installation.downloadAndInstall()
        }

        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let file = try AVAudioFile(forReading: url)

        async let collected = Self.collect(from: transcriber)
        if let lastSample = try await analyzer.analyzeSequence(from: file) {
            try await analyzer.finalizeAndFinish(through: lastSample)
        } else {
            await analyzer.cancelAndFinishNow()
        }
        let phrases = try await collected

        let formatted = phrases.map(\.text).joined(separator: " ")
        guard !formatted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIServiceError.noSpeech
        }
        return TranscriptionResult(
            text: formatted,
            languageCode: languageCode,
            segments: SentenceSplitter.split(formatted: formatted, words: Self.words(from: phrases))
        )
    }

    /// One finalised result: a phrase and where it sits in the audio.
    struct Phrase {
        var text: String
        var start: Double
        var duration: Double
    }

    private static func collect(from transcriber: SpeechTranscriber) async throws -> [Phrase] {
        var phrases: [Phrase] = []
        for try await result in transcriber.results where result.isFinal {
            let text = String(result.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let start = result.range.start.seconds
            let duration = result.range.duration.seconds
            phrases.append(Phrase(
                text: text,
                start: start.isFinite ? start : 0,
                duration: duration.isFinite ? duration : 0
            ))
        }
        return phrases
    }

    /// Spreads each phrase's time range across its words, so sentences get
    /// accurate start and end times for highlighting during playback.
    static func words(from phrases: [Phrase]) -> [SentenceSplitter.Word] {
        phrases.flatMap { phrase -> [SentenceSplitter.Word] in
            let tokens = phrase.text.split(whereSeparator: \.isWhitespace).map(String.init)
            guard !tokens.isEmpty else { return [] }
            let step = phrase.duration / Double(tokens.count)
            return tokens.enumerated().map { index, token in
                SentenceSplitter.Word(text: token, start: phrase.start + Double(index) * step, duration: step)
            }
        }
    }
}

/// Picks the best recogniser this iPhone has: SpeechAnalyzer when it
/// supports French, otherwise the classic SFSpeechRecognizer.
struct OnDeviceTranscriptionService: TranscriptionService {
    func transcribe(audioAt url: URL, languageCode: String) async throws -> TranscriptionResult {
        try await SpeechTranscriptionService.ensureAuthorized()
        if #available(iOS 26.0, *), await SpeechAnalyzerTranscriptionService.supportedLocale(for: languageCode) != nil {
            do {
                return try await SpeechAnalyzerTranscriptionService().transcribe(audioAt: url, languageCode: languageCode)
            } catch AIServiceError.noSpeech {
                throw AIServiceError.noSpeech
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                // Fall through to the classic recogniser.
            }
        }
        return try await SpeechTranscriptionService().transcribe(audioAt: url, languageCode: languageCode)
    }
}
