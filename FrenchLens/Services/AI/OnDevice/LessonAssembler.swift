import Foundation

/// Builds a lesson from a model's draft and the real transcript.
///
/// The transcript is the source of truth. Anything the model suggests that
/// doesn't appear in what was actually said (a verb form, a word, a grammar
/// excerpt) is dropped, so the lesson never teaches something the video
/// didn't contain. It also links transcript words to glossary entries so
/// they become tappable.
enum LessonAssembler {
    static let maxVocabulary = 6
    static let maxExpressions = 3
    static let maxVerbs = 4
    static let maxGrammar = 2

    /// Function words never worth a glossary link or a vocabulary card.
    static let stopwords: Set<String> = [
        "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "et", "ou", "mais",
        "en", "à", "a", "y", "ne", "n", "pas", "je", "j", "tu", "il", "elle", "on", "nous", "vous",
        "ils", "elles", "me", "m", "te", "t", "se", "s", "lui", "leur", "ce", "c", "ça", "qui", "que",
        "qu", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "nos",
        "vos", "leurs", "pour", "par", "sur", "dans", "avec", "très", "plus", "est", "si", "oui", "non",
    ]

    static func assemble(
        _ draft: LessonDraft,
        segments: [TranscriptionResult.Segment],
        fallbackLevel: CEFRLevel
    ) -> LessonAnalysis {
        let level = parseLevel(draft.level) ?? fallbackLevel
        let timed = segments.contains { $0.end > 0 }
        let transcriptText = segments.map(\.text).joined(separator: " ")
        let spoken = Set(words(in: transcriptText))
        let normalizedTranscript = words(in: transcriptText).joined(separator: " ")

        // Validate the model's suggestions against what was said.
        let verbs = draft.verbs
            .filter { !$0.formUsed.isEmpty && !$0.infinitive.isEmpty }
            .filter { verb in words(in: verb.formUsed).allSatisfy(spoken.contains) }
            .prefix(maxVerbs)
            .map { verb in
                VerbAnalysis(
                    infinitive: verb.infinitive.lowercased(),
                    english: verb.english,
                    formUsed: verb.formUsed,
                    tense: verb.tense.isEmpty ? "présent" : verb.tense,
                    person: verb.person,
                    auxiliary: verb.auxiliary.isEmpty ? nil : verb.auxiliary,
                    conjugation: uniqueRows(verb.conjugation),
                    example: sentence(containing: verb.formUsed, in: segments),
                    exampleTranslation: nil,
                    cefr: level,
                    note: verb.explanation.isEmpty ? nil : LevelledText(a1: verb.explanation)
                )
            }

        let vocabulary = unique(draft.vocabulary, by: { $0.french.lowercased() })
            .filter { !$0.french.isEmpty && !$0.english.isEmpty }
            .filter { item in contentWords(in: item.french).contains(where: spoken.contains) }
            .prefix(maxVocabulary)
            .map { item in
                VocabularyItem(
                    french: item.french,
                    english: item.english,
                    cefr: parseLevel(item.level) ?? level,
                    partOfSpeech: item.partOfSpeech.isEmpty ? nil : item.partOfSpeech,
                    example: item.example.isEmpty ? nil : item.example,
                    exampleTranslation: item.exampleTranslation.isEmpty ? nil : item.exampleTranslation
                )
            }

        let expressions = unique(draft.expressions, by: { $0.phrase.lowercased() })
            .filter { !$0.phrase.isEmpty && !$0.natural.isEmpty }
            .filter { expression in
                let content = contentWords(in: expression.phrase)
                guard !content.isEmpty else { return false }
                let present = content.filter(spoken.contains).count
                return Double(present) / Double(content.count) >= 0.5
            }
            .prefix(maxExpressions)
            .map { expression in
                ExpressionItem(
                    phrase: expression.phrase,
                    literal: expression.literal.isEmpty ? expression.phrase : expression.literal,
                    natural: expression.natural,
                    register: parseRegister(expression.register),
                    cefr: parseLevel(expression.level) ?? level,
                    note: expression.explanation.isEmpty ? nil : LevelledText(a1: expression.explanation),
                    example: nil
                )
            }

        let grammar = draft.grammar
            .filter { !$0.title.isEmpty && !$0.explanation.isEmpty }
            .filter { point in
                let excerpt = words(in: point.excerpt)
                guard !excerpt.isEmpty else { return false }
                if normalizedTranscript.contains(excerpt.joined(separator: " ")) { return true }
                return Double(excerpt.filter(spoken.contains).count) / Double(excerpt.count) >= 0.75
            }
            .prefix(maxGrammar)
            .enumerated()
            .map { index, point in
                GrammarPoint(
                    id: "g\(index)",
                    title: point.title,
                    pattern: point.pattern.isEmpty ? point.title : point.pattern,
                    excerpt: point.excerpt,
                    explanation: LevelledText(a1: point.explanation),
                    examples: Array(point.examples.filter { !$0.isEmpty }.prefix(3)),
                    cefr: level
                )
            }

        // Glossary: verbs first, then expressions, then vocabulary.
        var glossary: [WordGloss] = []
        var lookup: [String: String] = [:]
        func link(_ word: String, to key: String) {
            if lookup[word] == nil { lookup[word] = key }
        }
        for verb in verbs {
            let key = "v:\(verb.infinitive)"
            glossary.append(WordGloss(
                key: key, lemma: verb.infinitive, english: verb.english,
                partOfSpeech: "verb · \(verb.tense)", cefr: verb.cefr,
                forms: verb.conjugation.isEmpty ? nil : verb.conjugation, note: verb.note
            ))
            words(in: verb.formUsed).forEach { link($0, to: key) }
        }
        for expression in expressions {
            let key = "e:\(expression.phrase.lowercased())"
            glossary.append(WordGloss(
                key: key, lemma: expression.phrase, english: expression.natural,
                partOfSpeech: "expression · \(expression.register.title.lowercased())", cefr: expression.cefr,
                forms: nil, note: expression.note
            ))
            contentWords(in: expression.phrase).forEach { link($0, to: key) }
        }
        for item in vocabulary {
            let key = "w:\(item.french.lowercased())"
            glossary.append(WordGloss(
                key: key, lemma: item.french, english: item.english,
                partOfSpeech: item.partOfSpeech ?? "word", cefr: item.cefr, forms: nil, note: nil
            ))
            contentWords(in: item.french).forEach { link($0, to: key) }
        }

        let transcriptSegments = segments.enumerated().map { index, segment in
            TranscriptSegment(
                id: "s\(index + 1)",
                start: timed ? segment.start : nil,
                end: timed ? segment.end : nil,
                tokens: segment.text.split(whereSeparator: \.isWhitespace).map { raw in
                    let token = String(raw)
                    return TranscriptToken(token, lookup: normalize(token).flatMap { lookup[$0] })
                },
                translation: index < draft.sentenceTranslations.count && draft.sentenceTranslations.count == segments.count
                    ? draft.sentenceTranslations[index]
                    : nil
            )
        }

        let title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return LessonAnalysis(
            title: title.isEmpty ? fallbackTitle(transcriptText) : title,
            cefrLevel: level,
            transcript: Transcript(segments: transcriptSegments),
            translation: Translation(natural: draft.translation, literal: nil),
            vocabulary: Array(vocabulary),
            verbs: Array(verbs),
            expressions: Array(expressions),
            grammar: Array(grammar),
            pronunciation: [],
            glossary: glossary
        )
    }

    // MARK: Text helpers

    /// Lower-cased word without surrounding punctuation or an elided article
    /// or pronoun ("J'ai" → "ai", "l'école" → "école"). `nil` for pure punctuation.
    static func normalize(_ token: String) -> String? {
        var word = token.lowercased()
            .replacingOccurrences(of: "’", with: "'")
            .trimmingCharacters(in: CharacterSet.punctuationCharacters.union(.symbols).union(.whitespaces).subtracting(CharacterSet(charactersIn: "'-")))
            .trimmingCharacters(in: CharacterSet(charactersIn: "'-"))
        for prefix in ["j'", "l'", "d'", "c'", "n'", "s'", "m'", "t'", "qu'"] where word.hasPrefix(prefix) && word.count > prefix.count {
            word.removeFirst(prefix.count)
            break
        }
        return word.isEmpty ? nil : word
    }

    static func words(in text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace).compactMap { normalize(String($0)) }
    }

    static func contentWords(in text: String) -> [String] {
        words(in: text).filter { !stopwords.contains($0) && $0.count > 1 }
    }

    /// The first `max` words of `text`, to stay within a model's context.
    static func limitWords(_ text: String, to max: Int) -> String {
        let all = text.split(whereSeparator: \.isWhitespace)
        return all.count <= max ? text : all.prefix(max).joined(separator: " ")
    }

    static func parseLevel(_ text: String) -> CEFRLevel? {
        let upper = text.uppercased()
        return CEFRLevel.allCases.first { upper.contains($0.rawValue) }
    }

    static func parseRegister(_ text: String) -> Register {
        let lower = text.lowercased()
        if lower.contains("slang") || lower.contains("argot") { return .slang }
        if lower.contains("informal") || lower.contains("familier") || lower.contains("casual") { return .informal }
        if lower.contains("formal") || lower.contains("soutenu") { return .formal }
        return .neutral
    }

    private static func sentence(containing form: String, in segments: [TranscriptionResult.Segment]) -> String? {
        let target = words(in: form).joined(separator: " ")
        return segments.first { words(in: $0.text).joined(separator: " ").contains(target) }?.text
    }

    private static func uniqueRows(_ rows: [ConjugationRow]) -> [ConjugationRow] {
        unique(rows.filter { !$0.pronoun.isEmpty && !$0.form.isEmpty }, by: { $0.pronoun.lowercased() })
    }

    private static func unique<T>(_ items: [T], by key: (T) -> String) -> [T] {
        var seen = Set<String>()
        return items.filter { seen.insert(key($0)).inserted }
    }

    private static func fallbackTitle(_ text: String) -> String {
        let words = text.split(whereSeparator: \.isWhitespace).prefix(4).joined(separator: " ")
        return words.isEmpty ? "Your French video" : words + "…"
    }
}
