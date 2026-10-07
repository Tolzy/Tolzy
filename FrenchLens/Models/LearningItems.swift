import Foundation

/// A useful word or chunk. FrenchLens does not explain every word.
struct VocabularyItem: Codable, Hashable, Identifiable {
    var french: String
    var english: String
    var cefr: CEFRLevel
    var partOfSpeech: String?
    var example: String?
    var exampleTranslation: String?

    var id: String { french.lowercased() }
}

/// One pronoun/form pair in a conjugation table.
struct ConjugationRow: Codable, Hashable, Identifiable {
    var pronoun: String
    var form: String

    var id: String { pronoun + "|" + form }

    /// "je prépare"; elides "je" before a vowel ("j'ai").
    var phrase: String {
        let vowels = "aeiouyéèêàâîôûh"
        if pronoun == "je", let first = form.lowercased().first, vowels.contains(first) {
            return "j'" + form
        }
        return pronoun + " " + form
    }
}

/// The signature feature: a verb exactly as it was used, and why.
struct VerbAnalysis: Codable, Hashable, Identifiable {
    var infinitive: String
    var english: String
    /// The exact form heard, e.g. "suis allé".
    var formUsed: String
    /// e.g. "passé composé", "présent".
    var tense: String
    /// e.g. "je (1st person singular)".
    var person: String
    /// Auxiliary for compound tenses ("être"/"avoir").
    var auxiliary: String?
    /// The conjugation in the tense that was used.
    var conjugation: [ConjugationRow]
    var example: String?
    var exampleTranslation: String?
    var cefr: CEFRLevel
    var note: LevelledText?

    var id: String { infinitive + "|" + formUsed }

    /// The conjugation row matching the form used, if present.
    var usedRow: ConjugationRow? {
        conjugation.first { $0.form.lowercased() == formUsed.lowercased() }
    }
}

enum Register: String, Codable, CaseIterable {
    case formal, neutral, informal, slang

    var title: String { rawValue.capitalized }
}

/// An idiom or set phrase whose meaning is not the sum of its words.
struct ExpressionItem: Codable, Hashable, Identifiable {
    var phrase: String
    var literal: String
    var natural: String
    var register: Register
    var cefr: CEFRLevel
    var note: LevelledText?
    var example: String?

    var id: String { phrase.lowercased() }
}

/// Grammar that actually appears in the content — never an unrelated lesson.
struct GrammarPoint: Codable, Hashable, Identifiable {
    var id: String
    /// e.g. "Aller + infinitive".
    var title: String
    /// e.g. "aller (conjugated) + infinitive".
    var pattern: String
    /// The fragment from the content that uses it.
    var excerpt: String
    var explanation: LevelledText
    var examples: [String]
    var cefr: CEFRLevel
}

struct PronunciationNote: Codable, Hashable, Identifiable {
    var phrase: String
    var ipa: String?
    var tip: LevelledText

    var id: String { phrase.lowercased() }
}

/// What appears in the floating panel when a transcript word is tapped.
struct WordGloss: Codable, Hashable, Identifiable {
    var key: String
    /// Dictionary form, e.g. "préparer".
    var lemma: String
    var english: String
    var partOfSpeech: String
    var cefr: CEFRLevel
    /// Present-tense forms for verbs (first three persons are shown).
    var forms: [ConjugationRow]?
    var note: LevelledText?

    var id: String { key }
}
