import Foundation

/// One flashcard-style question generated from saved content.
struct ReviewExercise: Identifiable, Equatable {
    enum Kind: String, Equatable {
        /// What does "en avoir marre" mean?
        case meaning
        /// What is the infinitive of "suis allé"?
        case infinitive
        /// Complete: "Je ___ au marché hier."
        case completion
    }

    var id: String
    var kind: Kind
    var prompt: String
    /// The French the question is about, shown large.
    var focus: String
    var options: [String]
    var answer: String
    var explanation: String?

    var answerIndex: Int? { options.firstIndex(of: answer) }
}

/// Deterministic, seedable RNG so tests and previews are stable.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed == 0 ? 0x9E37_79B9_7F4A_7C15 : seed
    }

    /// SplitMix64.
    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

/// Builds review questions from saved vocabulary, verbs and expressions.
/// Elegant and finite: no streaks, no points, no lives.
struct ReviewExerciseGenerator {
    var optionCount = 4

    static let fallbackMeanings = ["to sleep", "tomorrow", "the city", "slowly", "to forget", "a friend"]
    static let fallbackInfinitives = ["avoir", "être", "faire", "prendre", "venir", "aller"]

    func exercises(from lessons: [Lesson], limit: Int = 10, seed: UInt64 = 42) -> [ReviewExercise] {
        var rng = SeededGenerator(seed: seed)

        let vocabulary = unique(lessons.flatMap(\.analysis.vocabulary), by: \.id)
        let expressions = unique(lessons.flatMap(\.analysis.expressions), by: \.id)
        let verbs = unique(lessons.flatMap(\.analysis.verbs), by: \.id)

        let meaningPool = vocabulary.map(\.english) + expressions.map(\.natural)
        let infinitivePool = verbs.map(\.infinitive)

        var meaning: [ReviewExercise] = []
        for item in expressions {
            meaning.append(ReviewExercise(
                id: "expression.\(item.id)",
                kind: .meaning,
                prompt: "What does this mean?",
                focus: item.phrase,
                options: options(answer: item.natural, pool: meaningPool, fallback: Self.fallbackMeanings, rng: &rng),
                answer: item.natural,
                explanation: "Literally “\(item.literal)”. \(item.register.title)."
            ))
        }
        for item in vocabulary {
            meaning.append(ReviewExercise(
                id: "vocabulary.\(item.id)",
                kind: .meaning,
                prompt: "What does this mean?",
                focus: item.french,
                options: options(answer: item.english, pool: meaningPool, fallback: Self.fallbackMeanings, rng: &rng),
                answer: item.english,
                explanation: item.example
            ))
        }

        var infinitive: [ReviewExercise] = []
        var completion: [ReviewExercise] = []
        for verb in verbs {
            if verb.formUsed.lowercased() != verb.infinitive.lowercased() {
                infinitive.append(ReviewExercise(
                    id: "infinitive.\(verb.id)",
                    kind: .infinitive,
                    prompt: "What is the infinitive?",
                    focus: verb.formUsed,
                    options: options(answer: verb.infinitive, pool: infinitivePool, fallback: Self.fallbackInfinitives, rng: &rng),
                    answer: verb.infinitive,
                    explanation: "\(verb.formUsed) · \(verb.tense) of \(verb.infinitive), \(verb.english)."
                ))
            }
            if let cloze = Self.cloze(for: verb) {
                let forms = verb.conjugation.map { Self.cleanForm($0.form) } + verbs.map(\.formUsed)
                completion.append(ReviewExercise(
                    id: "completion.\(verb.id)",
                    kind: .completion,
                    prompt: "Complete the sentence",
                    focus: cloze,
                    options: options(answer: verb.formUsed, pool: forms, fallback: [], rng: &rng),
                    answer: verb.formUsed,
                    explanation: verb.example.map { "\($0) — \(verb.exampleTranslation ?? verb.english)" }
                ))
            }
        }

        // Interleave kinds so a session feels varied, then cap.
        var buckets = [meaning.shuffled(using: &rng), infinitive.shuffled(using: &rng), completion.shuffled(using: &rng)]
        var result: [ReviewExercise] = []
        while result.count < limit, buckets.contains(where: { !$0.isEmpty }) {
            for index in buckets.indices where !buckets[index].isEmpty && result.count < limit {
                result.append(buckets[index].removeFirst())
            }
        }
        return result
    }

    /// "Je suis allé au marché hier." → "Je ___ au marché hier."
    static func cloze(for verb: VerbAnalysis) -> String? {
        guard let example = verb.example, verb.formUsed != verb.infinitive,
              let range = example.range(of: verb.formUsed, options: [.caseInsensitive])
        else { return nil }
        return example.replacingCharacters(in: range, with: "___")
    }

    /// Removes agreement hints: "sommes allé(e)s" → "sommes allés".
    static func cleanForm(_ form: String) -> String {
        form.replacingOccurrences(of: #"\([^)]*\)"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }

    private func options(answer: String, pool: [String], fallback: [String], rng: inout SeededGenerator) -> [String] {
        var distractors = unique((pool + fallback).filter { $0.lowercased() != answer.lowercased() }, by: { $0.lowercased() })
        distractors.shuffle(using: &rng)
        var options = Array(distractors.prefix(optionCount - 1)) + [answer]
        options.shuffle(using: &rng)
        return options
    }

    private func unique<T, Key: Hashable>(_ items: [T], by key: (T) -> Key) -> [T] {
        var seen = Set<Key>()
        return items.filter { seen.insert(key($0)).inserted }
    }
}
