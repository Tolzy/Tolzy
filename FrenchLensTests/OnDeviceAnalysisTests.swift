import XCTest
@testable import FrenchLens

final class SentenceSplitterTests: XCTestCase {
    private func words(_ text: String, step: Double = 0.4) -> [SentenceSplitter.Word] {
        text.split(separator: " ").enumerated().map { i, w in
            SentenceSplitter.Word(text: String(w), start: Double(i) * step, duration: step * 0.9)
        }
    }

    func testSplitsOnTerminatorsAndKeepsFrenchSpacedPunctuation() {
        XCTAssertEqual(
            SentenceSplitter.sentences(in: "Aujourd'hui, je vais au marché. C'est parti ! Tu viens ?"),
            ["Aujourd'hui, je vais au marché.", "C'est parti !", "Tu viens ?"]
        )
    }

    func testAssignsTimingsWordByWord() {
        let text = "J'ai faim. On mange ?"
        let segments = SentenceSplitter.split(formatted: text, words: words("J'ai faim On mange"))
        XCTAssertEqual(segments.map(\.text), ["J'ai faim.", "On mange ?"])
        XCTAssertEqual(segments[0].start, 0, accuracy: 0.001)
        XCTAssertEqual(segments[1].start, 0.8, accuracy: 0.001)
        XCTAssertGreaterThan(segments[1].end, segments[1].start)
    }

    func testBreaksLongUnpunctuatedSpeech() {
        let text = (1...40).map { "mot\($0)" }.joined(separator: " ")
        let segments = SentenceSplitter.split(formatted: text, words: [])
        XCTAssertGreaterThan(segments.count, 1)
        XCTAssertTrue(segments.allSatisfy { $0.text.split(separator: " ").count <= SentenceSplitter.preferredMaxWords + 2 })
        XCTAssertEqual(segments.flatMap { $0.text.split(separator: " ") }.count, 40, "No words lost")
    }
}

final class LessonAssemblerTests: XCTestCase {
    private let segments: [TranscriptionResult.Segment] = [
        .init(start: 0, end: 2.4, text: "Hier, je suis allé au marché."),
        .init(start: 2.4, end: 5, text: "J'en ai marre de travailler !"),
    ]

    private func draft() -> LessonDraft {
        LessonDraft(
            title: "Au marché",
            level: "A2",
            translation: "Yesterday I went to the market. I'm fed up with working!",
            sentenceTranslations: ["Yesterday, I went to the market.", "I'm fed up with working!"],
            vocabulary: [
                .init(french: "le marché", english: "market", partOfSpeech: "noun", level: "A1", example: "", exampleTranslation: ""),
                .init(french: "la boulangerie", english: "bakery", partOfSpeech: "noun", level: "A1", example: "", exampleTranslation: ""),
            ],
            expressions: [
                .init(phrase: "en avoir marre", literal: "to have enough of it", natural: "to be fed up", register: "informal", level: "A2", explanation: "Very common."),
            ],
            verbs: [
                .init(formUsed: "suis allé", infinitive: "Aller", english: "to go", tense: "passé composé", person: "je", auxiliary: "être",
                      conjugation: [ConjugationRow(pronoun: "je", form: "suis allé"), ConjugationRow(pronoun: "je", form: "duplicate")], explanation: "Aller uses être."),
                .init(formUsed: "mangeons", infinitive: "manger", english: "to eat", tense: "présent", person: "nous", auxiliary: "",
                      conjugation: [], explanation: ""),
            ],
            grammar: [
                .init(title: "Passé composé with être", pattern: "être + participle", excerpt: "je suis allé", explanation: "Movement verbs use être.", examples: ["Elle est partie."]),
                .init(title: "Subjunctive", pattern: "que + subjonctif", excerpt: "il faut que tu viennes", explanation: "Not in the video.", examples: []),
            ]
        )
    }

    func testKeepsOnlyWhatWasActuallySaid() {
        let lesson = LessonAssembler.assemble(draft(), segments: segments, fallbackLevel: .a1)
        XCTAssertEqual(lesson.verbs.map(\.infinitive), ["aller"], "Invented 'mangeons' is dropped")
        XCTAssertEqual(lesson.vocabulary.map(\.french), ["le marché"], "Unsaid 'boulangerie' is dropped")
        XCTAssertEqual(lesson.expressions.map(\.phrase), ["en avoir marre"])
        XCTAssertEqual(lesson.expressions.first?.register, .informal)
        XCTAssertEqual(lesson.grammar.map(\.title), ["Passé composé with être"], "Grammar not in the video is dropped")
        XCTAssertEqual(lesson.verbs.first?.conjugation.count, 1, "Duplicate pronouns removed")
        XCTAssertEqual(lesson.verbs.first?.example, "Hier, je suis allé au marché.")
        XCTAssertEqual(lesson.cefrLevel, .a2)
    }

    func testBuildsTimedSegmentsWithTranslationsAndTappableWords() throws {
        let lesson = LessonAssembler.assemble(draft(), segments: segments, fallbackLevel: .a1)
        let first = try XCTUnwrap(lesson.transcript.segments.first)
        XCTAssertEqual(first.text, "Hier, je suis allé au marché.")
        XCTAssertEqual(first.start, 0)
        XCTAssertEqual(first.translation, "Yesterday, I went to the market.")

        let lookups = Dictionary(uniqueKeysWithValues: lesson.transcript.segments.flatMap(\.tokens).compactMap { t in t.lookup.map { (t.text, $0) } })
        XCTAssertEqual(lookups["suis"], "v:aller")
        XCTAssertEqual(lookups["allé"], "v:aller")
        XCTAssertEqual(lookups["marché."], "w:le marché")
        XCTAssertEqual(lookups["marre"], "e:en avoir marre")
        XCTAssertNil(lookups["je"], "Function words are not tappable")
        for key in Set(lookups.values) {
            XCTAssertNotNil(lesson.gloss(for: key), "Every link resolves: \(key)")
        }
    }

    func testPastedTextHasNoTimingsAndMismatchedTranslationsAreIgnored() {
        var d = draft()
        d.sentenceTranslations = ["Only one"]
        let text = SentenceSplitter.split(formatted: "Hier, je suis allé au marché. J'en ai marre de travailler !", words: [])
        let lesson = LessonAssembler.assemble(d, segments: text, fallbackLevel: .b1)
        XCTAssertNil(lesson.transcript.segments.first?.start)
        XCTAssertTrue(lesson.transcript.segments.allSatisfy { $0.translation == nil })
    }

    func testNormalizeHandlesElisionAndPunctuation() {
        XCTAssertEqual(LessonAssembler.normalize("J'ai"), "ai")
        XCTAssertEqual(LessonAssembler.normalize("l’école,"), "école")
        XCTAssertEqual(LessonAssembler.normalize("petit-déjeuner."), "petit-déjeuner")
        XCTAssertEqual(LessonAssembler.normalize("Aujourd'hui"), "aujourd'hui")
        XCTAssertNil(LessonAssembler.normalize("!"))
    }

    func testEmptyDraftStillGivesTranscriptAndFallbackTitle() {
        let empty = LessonDraft(title: "", level: "", translation: "", sentenceTranslations: [])
        let lesson = LessonAssembler.assemble(empty, segments: segments, fallbackLevel: .b2)
        XCTAssertEqual(lesson.cefrLevel, .b2)
        XCTAssertEqual(lesson.transcript.segments.count, 2)
        XCTAssertFalse(lesson.title.isEmpty)
    }

    func testErrorsMapToHonestMessages() {
        XCTAssertEqual(IngestError.from(AIServiceError.noSpeech), .noSpeech)
        XCTAssertEqual(IngestError.from(AIServiceError.speechPermissionDenied), .speechPermissionDenied)
        XCTAssertEqual(IngestError.from(AIServiceError.modelUnavailable("Turn it on.")), .onDeviceUnavailable("Turn it on."))
        XCTAssertEqual(IngestError.onDeviceUnavailable("Turn it on.").message, "Turn it on.")
        XCTAssertTrue(IngestError.onDeviceUnavailable("x").canRetry)
    }
}
