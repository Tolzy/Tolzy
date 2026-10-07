import Foundation

protocol TranslationService {
    /// Natural (not word-for-word) translation.
    func translate(_ text: String, from source: String, to target: String) async throws -> String
}

struct RemoteTranslationService: TranslationService {
    let client: APIClient

    private struct Request: Encodable {
        var text: String
        var source: String
        var target: String
        var style = "natural"
    }

    private struct Response: Decodable {
        var translation: String
    }

    func translate(_ text: String, from source: String, to target: String) async throws -> String {
        let response: Response = try await client.post(
            "v1/translations",
            body: Request(text: text, source: source, target: target)
        )
        return response.translation
    }
}

/// Translates sentences one by one, keeping their order. Used for the
/// per-sentence lines under the transcript and the overall meaning.
protocol SentenceTranslating {
    func translate(sentences: [String]) async throws -> [String]
}
