import Foundation
@testable import FrenchLens

final class FakeMedia: MediaProcessing {
    var hasAudio = true
    let directory = TestFiles.temporaryDirectory()
    private(set) var storedSources: [URL] = []

    func hasAudioTrack(at url: URL) async -> Bool { hasAudio }

    func storeMedia(at url: URL) throws -> String {
        storedSources.append(url)
        return "stored-\(url.lastPathComponent)"
    }

    func mediaURL(named name: String) -> URL { directory.appendingPathComponent(name) }

    func makeThumbnail(forMediaNamed name: String) async -> String? { nil }

    func extractAudio(from url: URL) async throws -> URL { url }

    func storeImage(at url: URL) -> String? { "poster-\(url.lastPathComponent)" }
}

final class FakeAIService: AIService {
    var result: Result<LessonAnalysis, Error>
    var origin: AnalysisOrigin = .backend
    private(set) var inputs: [LessonInput] = []

    init(result: Result<LessonAnalysis, Error>) {
        self.result = result
    }

    func makeLesson(
        from input: LessonInput,
        level: CEFRLevel,
        progress: @escaping @Sendable (ProcessingStage) -> Void
    ) async throws -> LessonAnalysis {
        inputs.append(input)
        progress(.analyzing)
        return try result.get()
    }
}

enum Fixtures {
    static let analysis = LessonAnalysis(
        title: "Test",
        cefrLevel: .a1,
        transcript: Transcript(segments: [
            TranscriptSegment(id: "s1", start: 0, end: 1, tokens: [TranscriptToken("Bonjour", lookup: "bonjour")], translation: "Hello")
        ]),
        translation: Translation(natural: "Hello", literal: nil),
        glossary: [WordGloss(key: "bonjour", lemma: "bonjour", english: "hello", partOfSpeech: "interjection", cefr: .a1)]
    )

    static var demoLibrary: DemoLibrary {
        DemoLibrary.load(from: Bundle(for: LessonStore.self))
    }
}
