import Foundation
#if canImport(Translation)
import Translation
#endif

/// French → English with Apple's Translate models on the iPhone. Much more
/// faithful than asking a small language model to translate, and private.
/// Needs the French language downloaded (Settings → Analysis offers it).
@available(iOS 26.0, *)
struct AppleTranslationService: SentenceTranslating, TranslationService {
    enum Readiness: Equatable {
        case installed
        /// Supported but not downloaded yet.
        case needsDownload
        case unsupported
    }

    static let source = Locale.Language(identifier: "fr")
    static let target = Locale.Language(identifier: "en")

    static func readiness() async -> Readiness {
        switch await LanguageAvailability().status(from: source, to: target) {
        case .installed: .installed
        case .supported: .needsDownload
        default: .unsupported
        }
    }

    func translate(sentences: [String]) async throws -> [String] {
        guard !sentences.isEmpty else { return [] }
        guard await Self.readiness() == .installed else { throw AIServiceError.invalidResponse }
        let session = TranslationSession(installedSource: Self.source, target: Self.target)
        let requests = sentences.enumerated().map { index, sentence in
            TranslationSession.Request(sourceText: sentence, clientIdentifier: String(index))
        }
        let responses = try await session.translations(from: requests)
        var byIndex: [Int: String] = [:]
        for response in responses {
            if let id = response.clientIdentifier.flatMap(Int.init) { byIndex[id] = response.targetText }
        }
        let ordered = sentences.indices.compactMap { byIndex[$0] }
        guard ordered.count == sentences.count else { throw AIServiceError.invalidResponse }
        return ordered
    }

    func translate(_ text: String, from source: String, to target: String) async throws -> String {
        try await translate(sentences: [text]).first ?? ""
    }
}
