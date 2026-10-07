import Foundation

/// What a language model returns before validation: plain strings, possibly
/// wrong, possibly invented. `LessonAssembler` turns it into a `LessonAnalysis`.
struct LessonDraft: Equatable {
    struct Vocabulary: Equatable {
        var french: String
        var english: String
        var partOfSpeech: String
        var level: String
        var example: String
        var exampleTranslation: String
    }

    struct Expression: Equatable {
        var phrase: String
        var literal: String
        var natural: String
        var register: String
        var level: String
        var explanation: String
    }

    struct Verb: Equatable {
        var formUsed: String
        var infinitive: String
        var english: String
        var tense: String
        var person: String
        var auxiliary: String
        var conjugation: [ConjugationRow]
        var explanation: String
    }

    struct Grammar: Equatable {
        var title: String
        var pattern: String
        var excerpt: String
        var explanation: String
        var examples: [String]
    }

    var title: String
    var level: String
    var translation: String
    var sentenceTranslations: [String]
    var vocabulary: [Vocabulary] = []
    var expressions: [Expression] = []
    var verbs: [Verb] = []
    var grammar: [Grammar] = []
}
