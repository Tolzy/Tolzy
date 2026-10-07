import Foundation
import Observation

/// One card in the swipe deck: French on the front, everything worth
/// knowing about it on the back.
struct Flashcard: Identifiable, Equatable {
    enum Kind: String, Equatable {
        case word, expression, verb

        var label: String {
            switch self {
            case .word: "Word"
            case .expression: "Expression"
            case .verb: "Verb"
            }
        }
    }

    var id: String
    var kind: Kind
    /// The French, big on the front.
    var front: String
    /// A small line under it: part of speech, register or tense.
    var hint: String
    var meaning: String
    var literal: String?
    var example: String?
    var exampleTranslation: String?
    var note: String?
    var conjugation: [ConjugationRow] = []
    /// The form the learner met, highlighted in the conjugation.
    var highlightedForm: String?
    var level: CEFRLevel
    var lessonTitle: String
}

/// Builds a varied deck from saved lessons: words, expressions and verbs,
/// shuffled together (deterministically, for tests).
enum FlashcardBuilder {
    static func cards(from lessons: [Lesson], level: CEFRLevel, limit: Int = 20, seed: UInt64 = 42) -> [Flashcard] {
        var seen = Set<String>()
        var cards: [Flashcard] = []

        for lesson in lessons {
            let title = lesson.analysis.title
            for item in lesson.analysis.vocabulary where seen.insert("w|" + item.id).inserted {
                cards.append(Flashcard(
                    id: "w|" + item.id, kind: .word, front: item.french,
                    hint: item.partOfSpeech ?? "word", meaning: item.english,
                    example: item.example, exampleTranslation: item.exampleTranslation,
                    level: item.cefr, lessonTitle: title
                ))
            }
            for item in lesson.analysis.expressions where seen.insert("e|" + item.id).inserted {
                cards.append(Flashcard(
                    id: "e|" + item.id, kind: .expression, front: item.phrase,
                    hint: item.register.title.lowercased() + " expression", meaning: item.natural,
                    literal: item.literal, example: item.example,
                    note: item.note?.text(for: level),
                    level: item.cefr, lessonTitle: title
                ))
            }
            for verb in lesson.analysis.verbs where seen.insert("v|" + verb.id).inserted {
                cards.append(Flashcard(
                    id: "v|" + verb.id, kind: .verb, front: verb.formUsed,
                    hint: "\(verb.infinitive) · \(verb.tense)", meaning: "\(verb.english) (\(verb.infinitive))",
                    example: verb.example, exampleTranslation: verb.exampleTranslation,
                    note: verb.note?.text(for: level),
                    conjugation: verb.conjugation, highlightedForm: verb.usedRow?.form ?? verb.formUsed,
                    level: verb.cefr, lessonTitle: title
                ))
            }
        }

        var rng = SeededGenerator(seed: seed)
        return Array(cards.shuffled(using: &rng).prefix(limit))
    }
}

/// A run through the deck. Swipe right: "I know it". Swipe left: "Still
/// learning". Undo puts the last card back; the learning pile can be
/// gone through again.
@Observable
final class FlashcardSession {
    enum Verdict: Equatable { case known, learning }

    private(set) var cards: [Flashcard] = []
    private(set) var index = 0
    private(set) var known: [Flashcard] = []
    private(set) var learning: [Flashcard] = []
    @ObservationIgnored private var history: [Verdict] = []

    var current: Flashcard? { cards.indices.contains(index) ? cards[index] : nil }
    /// The cards behind the current one, nearest first.
    var upcoming: [Flashcard] { Array(cards.dropFirst(index + 1).prefix(2)) }
    var isFinished: Bool { !cards.isEmpty && index >= cards.count }
    var canUndo: Bool { !history.isEmpty }
    var progress: Double { cards.isEmpty ? 0 : Double(index) / Double(cards.count) }

    func start(with cards: [Flashcard]) {
        self.cards = cards
        index = 0
        known = []
        learning = []
        history = []
    }

    func mark(_ verdict: Verdict) {
        guard let current else { return }
        switch verdict {
        case .known: known.append(current)
        case .learning: learning.append(current)
        }
        history.append(verdict)
        index += 1
    }

    func undo() {
        guard let last = history.popLast(), index > 0 else { return }
        index -= 1
        switch last {
        case .known: known.removeLast()
        case .learning: learning.removeLast()
        }
    }

    /// Go again with just the cards still being learned.
    func reviewLearningAgain() {
        start(with: learning)
    }
}
