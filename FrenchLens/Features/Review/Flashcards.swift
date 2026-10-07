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

/// A run through the deck, Strava-style: the cards form a looping carousel
/// you swipe through; open one to learn about it, then mark it as known
/// (it leaves the deck) or keep practising it (it stays in the loop).
@Observable
final class FlashcardSession {
    private(set) var cards: [Flashcard] = []
    /// The card on top of the stack.
    private(set) var index = 0
    private(set) var known: [Flashcard] = []
    private(set) var practised: Set<String> = []
    private(set) var total = 0

    var current: Flashcard? { cards.indices.contains(index) ? cards[index] : nil }
    /// The next cards in the loop, nearest first, peeking behind the top one.
    var upcoming: [Flashcard] {
        guard cards.count > 1 else { return [] }
        return (1...min(2, cards.count - 1)).map { cards[(index + $0) % cards.count] }
    }
    var isFinished: Bool { total > 0 && cards.isEmpty }
    var progress: Double { total == 0 ? 0 : Double(known.count) / Double(total) }

    func start(with cards: [Flashcard]) {
        self.cards = cards
        total = cards.count
        index = 0
        known = []
        practised = []
    }

    func next() {
        guard !cards.isEmpty else { return }
        index = (index + 1) % cards.count
    }

    func previous() {
        guard !cards.isEmpty else { return }
        index = (index - 1 + cards.count) % cards.count
    }

    /// "I know this": the card leaves the deck.
    func markKnown(_ id: String) {
        guard let position = cards.firstIndex(where: { $0.id == id }) else { return }
        known.append(cards.remove(at: position))
        if position < index { index -= 1 }
        if index >= cards.count { index = 0 }
    }

    /// "Keep practising": it stays in the loop; move on to the next one.
    func keepPractising(_ id: String) {
        practised.insert(id)
        if current?.id == id { next() }
    }

    func card(id: String) -> Flashcard? {
        cards.first { $0.id == id } ?? known.first { $0.id == id }
    }
}
