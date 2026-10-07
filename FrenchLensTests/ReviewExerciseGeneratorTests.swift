import XCTest
@testable import FrenchLens

final class ReviewExerciseGeneratorTests: XCTestCase {
    private var lessons: [Lesson] {
        Fixtures.demoLibrary.lessons.map { $0.makeLesson(level: .a1) }
    }

    func testGeneratesAllThreeKindsFromSavedContent() {
        let exercises = ReviewExerciseGenerator().exercises(from: lessons, limit: 30)
        let kinds = Set(exercises.map(\.kind))
        XCTAssertEqual(kinds, [.meaning, .infinitive, .completion])
        for exercise in exercises {
            XCTAssertTrue(exercise.options.contains(exercise.answer), exercise.id)
            XCTAssertEqual(Set(exercise.options).count, exercise.options.count, "No duplicate options: \(exercise.id)")
            XCTAssertGreaterThanOrEqual(exercise.options.count, 2)
        }
    }

    func testSpecExamples() throws {
        let exercises = ReviewExerciseGenerator().exercises(from: lessons, limit: 100)

        let marre = try XCTUnwrap(exercises.first { $0.focus == "en avoir marre de" })
        XCTAssertEqual(marre.answer, "to be fed up with")

        let infinitive = try XCTUnwrap(exercises.first { $0.kind == .infinitive && $0.focus == "suis allé" })
        XCTAssertEqual(infinitive.answer, "aller")

        let cloze = try XCTUnwrap(exercises.first { $0.kind == .completion && $0.answer == "suis allé" })
        XCTAssertEqual(cloze.focus, "Je ___ au marché hier.")
    }

    func testDeterministicForSeed() {
        let a = ReviewExerciseGenerator().exercises(from: lessons, seed: 7)
        let b = ReviewExerciseGenerator().exercises(from: lessons, seed: 7)
        XCTAssertEqual(a, b)
        XCTAssertEqual(a.count, 10)
    }

    func testNothingSavedMeansNothingToReview() {
        XCTAssertTrue(ReviewExerciseGenerator().exercises(from: []).isEmpty)
    }

    func testCleanFormRemovesAgreementHints() {
        XCTAssertEqual(ReviewExerciseGenerator.cleanForm("sommes allé(e)s"), "sommes allés")
        XCTAssertEqual(ReviewExerciseGenerator.cleanForm("suis allé(e)"), "suis allé")
    }

    func testSessionFlow() {
        let session = ReviewSession()
        session.start(from: lessons)
        XCTAssertEqual(session.phase, .question)
        let first = session.current!
        session.choose(first.answer)
        XCTAssertEqual(session.phase, .answered(correct: true))
        XCTAssertEqual(session.correctCount, 1)
        session.advance()
        XCTAssertEqual(session.index, 1)
        XCTAssertEqual(session.phase, .question)
    }
}
