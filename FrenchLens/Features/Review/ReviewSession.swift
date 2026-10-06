import Foundation
import Observation

/// State for one review run.
@Observable
final class ReviewSession {
    enum Phase: Equatable {
        case intro
        case question
        case answered(correct: Bool)
        case finished
    }

    private(set) var exercises: [ReviewExercise] = []
    private(set) var index = 0
    private(set) var phase: Phase = .intro
    private(set) var selectedOption: String?
    private(set) var correctCount = 0

    @ObservationIgnored private let generator = ReviewExerciseGenerator()

    var current: ReviewExercise? {
        exercises.indices.contains(index) ? exercises[index] : nil
    }

    var progress: Double {
        exercises.isEmpty ? 0 : Double(index) / Double(exercises.count)
    }

    func start(from lessons: [Lesson]) {
        exercises = generator.exercises(from: lessons, seed: UInt64(Date().timeIntervalSince1970))
        index = 0
        correctCount = 0
        selectedOption = nil
        phase = exercises.isEmpty ? .intro : .question
    }

    func choose(_ option: String) {
        guard phase == .question, let current else { return }
        selectedOption = option
        let correct = option == current.answer
        if correct { correctCount += 1 }
        phase = .answered(correct: correct)
    }

    func advance() {
        guard case .answered = phase else { return }
        selectedOption = nil
        if index + 1 < exercises.count {
            index += 1
            phase = .question
        } else {
            index = exercises.count
            phase = .finished
        }
    }

    func reset() {
        phase = .intro
        index = 0
        selectedOption = nil
    }
}
