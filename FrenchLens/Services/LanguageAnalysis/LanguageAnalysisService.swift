import Foundation

/// Turns a transcript into a structured lesson for a given CEFR level.
protocol LanguageAnalysisService {
    func analyze(_ transcript: TranscriptionResult, level: CEFRLevel) async throws -> LessonAnalysis
}

struct RemoteLanguageAnalysisService: LanguageAnalysisService {
    let client: APIClient

    private struct Request: Encodable {
        var transcript: TranscriptionResult
        var level: CEFRLevel
        var explanationLanguage: String
        var schemaVersion = 1
    }

    func analyze(_ transcript: TranscriptionResult, level: CEFRLevel) async throws -> LessonAnalysis {
        try await client.post(
            "v1/analyses",
            body: Request(
                transcript: transcript,
                level: level,
                // B2 explanations are French-first; the server decides the mix.
                explanationLanguage: level == .b2 ? "fr" : "en"
            )
        )
    }
}
