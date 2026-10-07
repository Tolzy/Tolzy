import XCTest
@testable import FrenchLens

final class FlashcardTests: XCTestCase {
    private var lesson: Lesson {
        Lesson(source: LessonSource(kind: .text), analysis: Fixtures.analysis, origin: .backend)
    }

    func testDeckMixesWordsExpressionsAndVerbsWithoutDuplicates() {
        let cards = FlashcardBuilder.cards(from: [lesson, lesson], level: .a1, limit: 100)
        let analysis = Fixtures.analysis
        XCTAssertEqual(cards.count, analysis.vocabulary.count + analysis.expressions.count + analysis.verbs.count)
        XCTAssertEqual(Set(cards.map(\.id)).count, cards.count)
        if let verb = cards.first(where: { $0.kind == .verb }) {
            XCTAssertFalse(verb.conjugation.isEmpty)
            XCTAssertNotNil(verb.highlightedForm)
        }
    }

    func testDeckIsStableForASeedAndLimited() {
        let a = FlashcardBuilder.cards(from: [lesson], level: .a1, limit: 3, seed: 7)
        let b = FlashcardBuilder.cards(from: [lesson], level: .a1, limit: 3, seed: 7)
        XCTAssertEqual(a, b)
        XCTAssertLessThanOrEqual(a.count, 3)
    }

    func testCarouselLoopsAndKnownCardsLeave() {
        let cards = ["bonjour", "le marché", "j'ai faim", "demain"].map {
            Flashcard(id: $0, kind: .word, front: $0, hint: "word", meaning: $0, level: .a1, lessonTitle: "Test")
        }
        let session = FlashcardSession()
        session.start(with: cards)
        XCTAssertEqual(session.current, cards[0])
        XCTAssertEqual(session.upcoming, [cards[1], cards[2]])

        session.previous()
        XCTAssertEqual(session.current, cards[3], "The carousel loops")
        session.next()
        session.next()
        XCTAssertEqual(session.current, cards[1])

        session.markKnown(cards[1].id)
        XCTAssertEqual(session.current, cards[2], "The next card comes up")
        XCTAssertEqual(session.known, [cards[1]])
        XCTAssertEqual(session.progress, 0.25)

        session.keepPractising(cards[2].id)
        XCTAssertEqual(session.current, cards[3])
        XCTAssertTrue(session.practised.contains(cards[2].id))

        for card in [cards[0], cards[2], cards[3]] { session.markKnown(card.id) }
        XCTAssertTrue(session.isFinished)
        XCTAssertNil(session.current)
        XCTAssertEqual(session.progress, 1)
        XCTAssertEqual(session.card(id: cards[0].id), cards[0], "Known cards can still be looked up")
    }
}
