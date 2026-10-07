#if canImport(FoundationModels)
import Foundation
import FoundationModels

/// Builds a lesson from a French transcript with the on-device Apple
/// Intelligence model. Three focused requests (overview, words, verbs and
/// grammar) keep each one well inside the model's context window; the
/// results are validated against the transcript by `LessonAssembler`.
@available(iOS 26.0, *)
struct OnDeviceLanguageAnalysisService: LanguageAnalysisService {
    /// Long transcripts are analysed from their first part.
    static let maxWords = 320
    static let maxNumberedSentences = 24

    func analyze(_ transcript: TranscriptionResult, level: CEFRLevel) async throws -> LessonAnalysis {
        if case .unavailable(let reason) = SystemLanguageModel.default.availability {
            throw AIServiceError.modelUnavailable(OnDeviceCapability.message(for: OnDeviceCapability.status(for: reason)))
        }

        let segments = SentenceSplitter.segments(for: transcript)
        guard !segments.isEmpty else { throw AIServiceError.noSpeech }

        let text = LessonAssembler.limitWords(segments.map(\.text).joined(separator: " "), to: Self.maxWords)
        let numbered = segments.prefix(Self.maxNumberedSentences).enumerated()
            .map { "\($0.offset + 1). \($0.element.text)" }
            .joined(separator: "\n")
        let instructions = Self.instructions(for: level)

        let overview = try await generate(GeneratedOverview.self, instructions: instructions, prompt: """
            French transcript, one numbered sentence per line:
            \(numbered)

            Give a short English title for the clip, its overall CEFR level, a natural English \
            translation of the whole transcript, and a natural English translation of each \
            numbered sentence, in the same order.
            """)

        let words = try await generate(GeneratedWords.self, instructions: instructions, prompt: """
            French transcript:
            \(text)

            Choose the most useful vocabulary in this transcript for the learner: at most 6 words \
            or short chunks that actually appear in it. Skip names and very basic words such as \
            je, le, et, est. Also list idiomatic or informal expressions that are actually used \
            (at most 3, or none).
            """)

        let grammar = try await generate(GeneratedVerbsAndGrammar.self, instructions: instructions, prompt: """
            French transcript:
            \(text)

            Find the most important conjugated verbs that actually appear (at most 4). For each, \
            give the form exactly as written in the transcript (include the auxiliary for compound \
            tenses, for example "suis allé"), the infinitive, its English meaning, the tense in \
            French (présent, passé composé, imparfait, futur proche, futur simple, conditionnel, \
            impératif or subjonctif), the person, and the full conjugation of that tense for je, tu, \
            il/elle, nous, vous and ils/elles. Then explain at most 2 grammar points that appear in \
            the transcript, each with an exact quote from it.
            """)

        let draft = LessonDraft(
            title: overview.title,
            level: overview.level,
            translation: overview.translation,
            sentenceTranslations: segments.count <= Self.maxNumberedSentences ? overview.sentenceTranslations : [],
            vocabulary: words.vocabulary.map {
                LessonDraft.Vocabulary(french: $0.french, english: $0.english, partOfSpeech: $0.partOfSpeech,
                      level: $0.level, example: $0.example, exampleTranslation: $0.exampleTranslation)
            },
            expressions: words.expressions.map {
                LessonDraft.Expression(phrase: $0.phrase, literal: $0.literal, natural: $0.natural,
                      register: $0.register, level: $0.level, explanation: $0.explanation)
            },
            verbs: grammar.verbs.map { verb in
                LessonDraft.Verb(formUsed: verb.formUsed, infinitive: verb.infinitive, english: verb.english, tense: verb.tense,
                      person: verb.person, auxiliary: verb.auxiliary,
                      conjugation: verb.conjugation.map { ConjugationRow(pronoun: $0.pronoun, form: $0.form) },
                      explanation: verb.explanation)
            },
            grammar: grammar.grammar.map {
                LessonDraft.Grammar(title: $0.title, pattern: $0.pattern, excerpt: $0.excerpt,
                      explanation: $0.explanation, examples: $0.examples)
            }
        )
        return LessonAssembler.assemble(draft, segments: segments, fallbackLevel: level)
    }

    private func generate<Output: Generable>(_ type: Output.Type, instructions: String, prompt: String) async throws -> Output {
        let session = LanguageModelSession(instructions: instructions)
        do {
            return try await session.respond(to: prompt, generating: type).content
        } catch let error as LanguageModelSession.GenerationError {
            switch error {
            case .guardrailViolation: throw AIServiceError.contentBlocked
            case .exceededContextWindowSize: throw AIServiceError.transcriptTooLong
            default: throw AIServiceError.invalidResponse
            }
        }
    }

    static func instructions(for level: CEFRLevel) -> String {
        let audience: String
        switch level {
        case .a1:
            audience = "The learner is a beginner (CEFR A1). Write every explanation in very simple English, in one or two short sentences."
        case .a2:
            audience = "The learner is elementary (CEFR A2). Write explanations in simple English and add a short example."
        case .b1:
            audience = "The learner is intermediate (CEFR B1). Write clear English explanations that mention nuance, register and alternatives."
        case .b2:
            audience = "The learner is upper-intermediate (CEFR B2). Write explanations in simple French, mentioning register and context."
        }
        return """
            You are FrenchLens, a precise and friendly French teacher for English speakers. You \
            analyse short transcripts of French social-media videos. Only use words, verbs and \
            grammar that are actually in the transcript; never invent any. Translations must be \
            natural English, not word for word. \(audience)
            """
    }
}

// MARK: - Generable output shapes

@available(iOS 26.0, *)
@Generable
struct GeneratedOverview {
    @Guide(description: "A short English title for the clip, two to five words")
    var title: String
    @Guide(description: "The overall CEFR level of the French: A1, A2, B1 or B2")
    var level: String
    @Guide(description: "A natural, idiomatic English translation of the whole transcript")
    var translation: String
    @Guide(description: "A natural English translation of each numbered sentence, in order, one item per sentence")
    var sentenceTranslations: [String]
}

@available(iOS 26.0, *)
@Generable
struct GeneratedWords {
    @Guide(description: "At most 6 useful words or short chunks that appear in the transcript")
    var vocabulary: [GeneratedVocabulary]
    @Guide(description: "Idiomatic or informal expressions actually used in the transcript; empty if none")
    var expressions: [GeneratedExpression]
}

@available(iOS 26.0, *)
@Generable
struct GeneratedVocabulary {
    @Guide(description: "The word or chunk in French, with its article if it is a noun, e.g. le marché")
    var french: String
    @Guide(description: "Its English meaning in this context")
    var english: String
    @Guide(description: "noun, verb, adjective, adverb or phrase")
    var partOfSpeech: String
    @Guide(description: "CEFR level of the word: A1, A2, B1 or B2")
    var level: String
    @Guide(description: "A short new French example sentence using it")
    var example: String
    @Guide(description: "The English translation of the example")
    var exampleTranslation: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedExpression {
    @Guide(description: "The expression in French, in its dictionary form, e.g. en avoir marre")
    var phrase: String
    @Guide(description: "Its literal word-for-word meaning in English")
    var literal: String
    @Guide(description: "What it actually means, in natural English")
    var natural: String
    @Guide(description: "formal, neutral, informal or slang")
    var register: String
    @Guide(description: "CEFR level: A1, A2, B1 or B2")
    var level: String
    @Guide(description: "A short explanation of when people use it")
    var explanation: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedVerbsAndGrammar {
    @Guide(description: "At most 4 important conjugated verbs that appear in the transcript")
    var verbs: [GeneratedVerb]
    @Guide(description: "At most 2 grammar points that appear in the transcript")
    var grammar: [GeneratedGrammarPoint]
}

@available(iOS 26.0, *)
@Generable
struct GeneratedVerb {
    @Guide(description: "The verb exactly as written in the transcript, including any auxiliary, e.g. suis allé")
    var formUsed: String
    @Guide(description: "The infinitive, e.g. aller")
    var infinitive: String
    @Guide(description: "English meaning, e.g. to go")
    var english: String
    @Guide(description: "Tense in French, e.g. passé composé")
    var tense: String
    @Guide(description: "Grammatical person, e.g. je (1st person singular)")
    var person: String
    @Guide(description: "être or avoir for compound tenses, otherwise an empty string")
    var auxiliary: String
    @Guide(description: "The six forms of this tense for je, tu, il/elle, nous, vous, ils/elles")
    var conjugation: [GeneratedConjugationRow]
    @Guide(description: "A short explanation of this verb form for the learner")
    var explanation: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedConjugationRow {
    @Guide(description: "The pronoun: je, tu, il/elle, nous, vous or ils/elles")
    var pronoun: String
    @Guide(description: "The verb form for that pronoun, without the pronoun")
    var form: String
}

@available(iOS 26.0, *)
@Generable
struct GeneratedGrammarPoint {
    @Guide(description: "A short name, e.g. Aller + infinitive")
    var title: String
    @Guide(description: "The pattern, e.g. aller (présent) + infinitive")
    var pattern: String
    @Guide(description: "An exact quote from the transcript that uses it")
    var excerpt: String
    @Guide(description: "The explanation, written for the learner's level")
    var explanation: String
    @Guide(description: "One or two short new French examples")
    var examples: [String]
}
#endif
