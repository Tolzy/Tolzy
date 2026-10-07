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

    func testSwipingUndoAndGoingAgain() {
        let cards = ["bonjour", "le marché", "j'ai faim", "demain"].map {
            Flashcard(id: $0, kind: .word, front: $0, hint: "word", meaning: $0, level: .a1, lessonTitle: "Test")
        }
        let session = FlashcardSession()
        session.start(with: cards)
        XCTAssertEqual(session.current, cards[0])
        XCTAssertEqual(session.upcoming.first, cards[1])

        session.mark(.known)
        session.mark(.learning)
        XCTAssertEqual(session.known, [cards[0]])
        XCTAssertEqual(session.learning, [cards[1]])

        session.undo()
        XCTAssertEqual(session.current, cards[1])
        XCTAssertTrue(session.learning.isEmpty)

        while session.current != nil { session.mark(.learning) }
        XCTAssertTrue(session.isFinished)
        XCTAssertEqual(session.progress, 1)

        session.reviewLearningAgain()
        XCTAssertEqual(session.cards.count, cards.count - 1)
        XCTAssertEqual(session.index, 0)
        XCTAssertFalse(session.canUndo)
    }
}
