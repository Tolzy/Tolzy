import XCTest
@testable import FrenchLens

final class LessonDecodingTests: XCTestCase {
    func testAllDemoLessonsDecode() throws {
        let library = Fixtures.demoLibrary
        XCTAssertEqual(library.lessons.map(\.id), DemoLibrary.preferredOrder)

        for demo in library.lessons {
            let analysis = demo.analysis
            XCTAssertFalse(analysis.transcript.segments.isEmpty, demo.id)
            XCTAssertFalse(analysis.translation.natural.isEmpty, demo.id)
            XCTAssertFalse(analysis.vocabulary.isEmpty, demo.id)
            XCTAssertFalse(analysis.verbs.isEmpty, demo.id)
            XCTAssertFalse(analysis.expressions.isEmpty, demo.id)
            XCTAssertFalse(analysis.grammar.isEmpty, demo.id)

            // Every tappable word resolves to a gloss.
            for segment in analysis.transcript.segments {
                for token in segment.tokens {
                    if let key = token.lookup {
                        XCTAssertNotNil(analysis.gloss(for: key), "\(demo.id): missing gloss \(key)")
                    }
                }
            }
        }
    }

    func testSpecExampleLesson() throws {
        let marre = try XCTUnwrap(Fixtures.demoLibrary.lesson(id: "demo-en-avoir-marre"))
        XCTAssertEqual(marre.analysis.transcript.segments.first?.text, "J'en ai marre de travailler tous les jours.")
        XCTAssertEqual(marre.analysis.transcript.segments.first?.translation, "I'm tired of working every day.")
        XCTAssertTrue(marre.analysis.vocabulary.contains { $0.french == "franchement" && $0.english == "honestly" && $0.cefr == .a2 })
        XCTAssertTrue(marre.analysis.verbs.contains { $0.infinitive == "avoir" })
        XCTAssertTrue(marre.analysis.expressions.contains { $0.phrase == "en avoir marre de" && $0.register == .informal })
    }

    func testCompactAndFullTokensDecode() throws {
        let json = #"[ "Bonjour", { "text": "prépare", "lookup": "preparer" } ]"#
        let tokens = try JSONDecoder().decode([TranscriptToken].self, from: Data(json.utf8))
        XCTAssertEqual(tokens, [TranscriptToken("Bonjour"), TranscriptToken("prépare", lookup: "preparer")])

        // Round-trips back to the compact form.
        let encoded = try JSONEncoder().encode(tokens)
        XCTAssertEqual(try JSONDecoder().decode([TranscriptToken].self, from: encoded), tokens)
    }

    func testOptionalCollectionsMayBeOmitted() throws {
        let json = """
        {
          "title": "Minimal",
          "cefrLevel": "B1",
          "transcript": { "segments": [ { "id": "s1", "tokens": ["Salut"] } ] },
          "translation": { "natural": "Hi" }
        }
        """
        let analysis = try JSONDecoder().decode(LessonAnalysis.self, from: Data(json.utf8))
        XCTAssertEqual(analysis.cefrLevel, .b1)
        XCTAssertTrue(analysis.vocabulary.isEmpty)
        XCTAssertTrue(analysis.glossary.isEmpty)
        XCTAssertNil(analysis.transcript.segments[0].start)
    }

    func testVocabularyDecoding() throws {
        let json = #"{ "french": "franchement", "english": "honestly", "cefr": "A2", "example": "Franchement, non." }"#
        let item = try JSONDecoder().decode(VocabularyItem.self, from: Data(json.utf8))
        XCTAssertEqual(item.french, "franchement")
        XCTAssertEqual(item.english, "honestly")
        XCTAssertEqual(item.cefr, .a2)
        XCTAssertEqual(item.example, "Franchement, non.")
        XCTAssertNil(item.partOfSpeech)
    }

    func testVerbDecoding() throws {
        let json = """
        {
          "infinitive": "aller", "english": "to go", "formUsed": "suis allé",
          "tense": "passé composé", "person": "je", "auxiliary": "être",
          "conjugation": [ { "pronoun": "je", "form": "suis allé(e)" }, { "pronoun": "tu", "form": "es allé(e)" } ],
          "example": "Je suis allé au marché hier.", "cefr": "A2",
          "note": "Aller uses être."
        }
        """
        let verb = try JSONDecoder().decode(VerbAnalysis.self, from: Data(json.utf8))
        XCTAssertEqual(verb.infinitive, "aller")
        XCTAssertEqual(verb.formUsed, "suis allé")
        XCTAssertEqual(verb.auxiliary, "être")
        XCTAssertEqual(verb.conjugation.count, 2)
        XCTAssertEqual(verb.note?.text(for: .b2), "Aller uses être.", "A plain string note applies to every level")
    }

    func testLevelledTextFallsBackToLowerLevels() {
        let text = LevelledText(a1: "simple", a2: nil, b1: "nuanced", b2: nil)
        XCTAssertEqual(text.text(for: .a1), "simple")
        XCTAssertEqual(text.text(for: .a2), "simple")
        XCTAssertEqual(text.text(for: .b1), "nuanced")
        XCTAssertEqual(text.text(for: .b2), "nuanced")
    }

    func testTokenOffsetsMapSpeechRangesToWords() {
        let segment = TranscriptSegment(id: "s", tokens: [TranscriptToken("Je"), TranscriptToken("vais"), TranscriptToken("préparer")], translation: nil)
        XCTAssertEqual(segment.text, "Je vais préparer")
        XCTAssertEqual(segment.tokenOffsets, [0, 3, 8])
        XCTAssertEqual(segment.tokenIndex(atUTF16Offset: 0), 0)
        XCTAssertEqual(segment.tokenIndex(atUTF16Offset: 4), 1)
        XCTAssertEqual(segment.tokenIndex(atUTF16Offset: 9), 2)
    }

    func testConjugationPhraseElides() {
        XCTAssertEqual(ConjugationRow(pronoun: "je", form: "ai").phrase, "j'ai")
        XCTAssertEqual(ConjugationRow(pronoun: "je", form: "prépare").phrase, "je prépare")
        XCTAssertEqual(ConjugationRow(pronoun: "il/elle", form: "prépare").phrase, "il/elle prépare")
    }

    func testLessonRoundTripsThroughStore() throws {
        let directory = TestFiles.temporaryDirectory()
        let store = LessonStore(directory: directory)
        let lesson = Lesson(source: LessonSource(kind: .text), analysis: Fixtures.analysis, origin: .backend)
        store.add(lesson)
        store.setSaved(true, lessonID: lesson.id)

        let reloaded = LessonStore(directory: directory)
        XCTAssertEqual(reloaded.lessons, [store.lesson(id: lesson.id)!])
        XCTAssertEqual(reloaded.saved.map(\.id), [lesson.id])
    }
}

private extension TranscriptSegment {
    init(id: String, tokens: [TranscriptToken], translation: String?) {
        self.init(id: id, start: nil, end: nil, tokens: tokens, translation: translation)
    }
}
