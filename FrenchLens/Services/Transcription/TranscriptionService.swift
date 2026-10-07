import Foundation

/// Raw speech-to-text output, before any learning analysis.
struct TranscriptionResult: Codable, Hashable {
    struct Segment: Codable, Hashable {
        var start: Double
        var end: Double
        var text: String
    }

    var text: String
    var languageCode: String
    var segments: [Segment]
}

protocol TranscriptionService {
    func transcribe(audioAt url: URL, languageCode: String) async throws -> TranscriptionResult
}

/// Uploads audio to the FrenchLens backend, which calls the speech provider.
struct RemoteTranscriptionService: TranscriptionService {
    let client: APIClient

    func transcribe(audioAt url: URL, languageCode: String) async throws -> TranscriptionResult {
        try await client.upload(
            "v1/transcriptions",
            fileURL: url,
            mimeType: "audio/mp4",
            fields: ["language": languageCode]
        )
    }
}
