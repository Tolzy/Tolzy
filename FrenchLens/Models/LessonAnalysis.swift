import Foundation

/// The complete, strongly typed result of analysing one piece of French content.
/// This is the contract between the AI backend and the app.
struct LessonAnalysis: Codable, Hashable {
    var title: String
    var cefrLevel: CEFRLevel
    var transcript: Transcript
    var translation: Translation
    var vocabulary: [VocabularyItem]
    var verbs: [VerbAnalysis]
    var expressions: [ExpressionItem]
    var grammar: [GrammarPoint]
    var pronunciation: [PronunciationNote]
    /// Word-level lookups for tappable transcript tokens, keyed by `WordGloss.key`.
    var glossary: [WordGloss]

    init(
        title: String,
        cefrLevel: CEFRLevel,
        transcript: Transcript,
        translation: Translation,
        vocabulary: [VocabularyItem] = [],
        verbs: [VerbAnalysis] = [],
        expressions: [ExpressionItem] = [],
        grammar: [GrammarPoint] = [],
        pronunciation: [PronunciationNote] = [],
        glossary: [WordGloss] = []
    ) {
        self.title = title
        self.cefrLevel = cefrLevel
        self.transcript = transcript
        self.translation = translation
        self.vocabulary = vocabulary
        self.verbs = verbs
        self.expressions = expressions
        self.grammar = grammar
        self.pronunciation = pronunciation
        self.glossary = glossary
    }

    /// Optional collections may be omitted by the backend.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decode(String.self, forKey: .title)
        cefrLevel = try c.decode(CEFRLevel.self, forKey: .cefrLevel)
        transcript = try c.decode(Transcript.self, forKey: .transcript)
        translation = try c.decode(Translation.self, forKey: .translation)
        vocabulary = try c.decodeIfPresent([VocabularyItem].self, forKey: .vocabulary) ?? []
        verbs = try c.decodeIfPresent([VerbAnalysis].self, forKey: .verbs) ?? []
        expressions = try c.decodeIfPresent([ExpressionItem].self, forKey: .expressions) ?? []
        grammar = try c.decodeIfPresent([GrammarPoint].self, forKey: .grammar) ?? []
        pronunciation = try c.decodeIfPresent([PronunciationNote].self, forKey: .pronunciation) ?? []
        glossary = try c.decodeIfPresent([WordGloss].self, forKey: .glossary) ?? []
    }

    func gloss(for key: String) -> WordGloss? {
        glossary.first { $0.key == key }
    }

    /// One-line answer to "What can I learn from this?"
    var learningSummary: String {
        var parts: [String] = []
        func count(_ n: Int, _ singular: String, _ plural: String) {
            if n > 0 { parts.append("\(n) \(n == 1 ? singular : plural)") }
        }
        count(vocabulary.count, "word", "words")
        count(verbs.count, "verb", "verbs")
        count(expressions.count, "expression", "expressions")
        if let firstGrammar = grammar.first { parts.append(firstGrammar.title.lowercased()) }
        return parts.joined(separator: " · ")
    }
}

/// Natural meaning first; literal only as a secondary aid.
struct Translation: Codable, Hashable {
    var natural: String
    var literal: String?
}
