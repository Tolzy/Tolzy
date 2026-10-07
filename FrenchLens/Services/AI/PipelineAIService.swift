import Foundation

/// The real pipeline: extract audio → transcribe → analyse (→ translate if needed).
///
/// Each step is a protocol, so the same pipeline runs fully on the iPhone
/// (Apple speech recognition + Apple Intelligence) or against the FrenchLens
/// backend, and steps can be mixed.
struct PipelineAIService: AIService {
    let media: MediaProcessing
    let transcription: TranscriptionService
    let analysis: LanguageAnalysisService
    var translation: TranslationService?
    let origin: AnalysisOrigin

    func makeLesson(
        from input: LessonInput,
        level: CEFRLevel,
        progress: @escaping @Sendable (ProcessingStage) -> Void
    ) async throws -> LessonAnalysis {
        let transcript: TranscriptionResult
        switch input {
        case .media(let url):
            progress(.extractingAudio)
            let audioURL = try await media.extractAudio(from: url)
            defer { try? FileManager.default.removeItem(at: audioURL) }
            progress(.transcribing)
            transcript = try await transcription.transcribe(audioAt: audioURL, languageCode: "fr-FR")
        case .text(let text):
            transcript = TranscriptionResult(text: text, languageCode: "fr-FR", segments: [])
        }

        guard !transcript.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIServiceError.noSpeech
        }

        progress(.analyzing)
        var result = try await analysis.analyze(transcript, level: level)

        if result.translation.natural.isEmpty, let translation {
            result.translation.natural = try await translation.translate(transcript.text, from: "fr", to: "en")
        }
        progress(.buildingLesson)
        return result
    }
}
