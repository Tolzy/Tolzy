import Foundation

/// The small rules that make a conversation feel natural rather than
/// scripted: remember the learner's name, greet once, never say the same
/// thing twice, and don't cut someone off while they're searching for a word.
enum ConversationFlow {
    // MARK: Memory

    /// The learner's name, if they've said it ("je m'appelle Tosin",
    /// "moi c'est Tosin", "mon nom est Tosin", "my name is Tosin").
    static func name(in text: String) -> String? {
        let patterns = [
            #"(?i)je m['’]?\s?appelle\s+([\p{L}\-]+)"#,
            #"(?i)moi,?\s+c['’]est\s+([\p{L}\-]+)"#,
            #"(?i)mon (?:pr[ée])?nom,?\s+c['’]est\s+([\p{L}\-]+)"#,
            #"(?i)mon (?:pr[ée])?nom est\s+([\p{L}\-]+)"#,
            #"(?i)my name is\s+([\p{L}\-]+)"#,
        ]
        let notNames: Set<String> = ["comment", "euh", "eh", "le", "la", "un", "une", "pas", "et"]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern),
                  let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let range = Range(match.range(at: 1), in: text)
            else { continue }
            let word = String(text[range])
            guard !notNames.contains(word.lowercased()), word.count > 1 else { continue }
            return word.prefix(1).uppercased() + word.dropFirst()
        }
        return nil
    }

    // MARK: Greeting once

    private static let frenchGreetings = ["rebonjour", "re-bonjour", "bonjour", "bonsoir", "salut", "coucou", "hello", "hey"]
    private static let englishGreetings = ["hello again", "good morning", "good evening", "hello", "hi there", "hi", "hey"]

    /// Drops a greeting that opens a reply ("Bonjour Tosin ! Ça va bien…" →
    /// "Ça va bien…"). Only a short greeting phrase is removed, and only when
    /// something follows it. While a reply is still streaming, a lone
    /// greeting returns "" so it never flashes up and disappears.
    static func removingGreeting(_ text: String, english: Bool = false, isComplete: Bool = true) -> String {
        let greetings = english ? englishGreetings : frenchGreetings
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        guard let greeting = greetings.first(where: { lower.hasPrefix($0) }) else { return text }
        // "Salutations", "Hijack"… are not greetings.
        let afterGreeting = lower.dropFirst(greeting.count)
        if let next = afterGreeting.first, next.isLetter { return text }

        guard let end = trimmed.firstIndex(where: { "!.?,;:—".contains($0) }) else {
            // No punctuation yet: still streaming the greeting (or no break).
            return isComplete ? text : (trimmed.split(separator: " ").count <= 3 ? "" : text)
        }
        let phrase = trimmed[..<end]
        guard phrase.split(separator: " ").count <= 3 else { return text }

        var rest = trimmed[end...].drop(while: { "!.?,;:— ".contains($0) })
        rest = rest.drop(while: \.isWhitespace)
        guard !rest.isEmpty else { return isComplete ? text : "" }
        return rest.prefix(1).uppercased() + rest.dropFirst()
    }

    // MARK: No repeats

    /// Whether a reply says (nearly) the same as one of the recent ones.
    static func isRepeat(_ reply: String, of previous: [String]) -> Bool {
        let words = Set(TutorReply.spokenForm(reply).split(separator: " "))
        guard words.count >= 2 else { return false }
        return previous.suffix(4).contains { earlier in
            let other = Set(TutorReply.spokenForm(earlier).split(separator: " "))
            guard !other.isEmpty else { return false }
            let overlap = Double(words.intersection(other).count) / Double(words.union(other).count)
            return overlap >= 0.75
        }
    }

    // MARK: Turn taking

    /// Words people trail off on while they think of the next one.
    private static let hesitations: Set<String> = [
        "euh", "heu", "eh", "hum", "hmm", "bah", "ben", "bon", "alors", "donc", "et", "mais", "ou",
        "parce", "que", "qui", "je", "j'ai", "tu", "il", "elle", "on", "nous", "vous",
        "le", "la", "les", "l'", "un", "une", "des", "de", "du", "à", "au", "avec", "pour", "dans",
        "en", "sur", "très", "c'est", "mon", "ma", "mes", "ton", "ta", "um", "uh", "and", "the",
    ]

    /// How long a pause ends the learner's turn: longer when they're clearly
    /// mid-sentence ("Je m'appelle Tosin et… euh…").
    static func silenceNeeded(after transcript: String, base: TimeInterval) -> TimeInterval {
        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasSuffix(",") || trimmed.hasSuffix("…") || trimmed.hasSuffix("...") { return base + 1.2 }
        let last = trimmed.lowercased()
            .split(whereSeparator: { $0.isWhitespace })
            .last
            .map { $0.trimmingCharacters(in: .punctuationCharacters) } ?? ""
        if hesitations.contains(last) || last.hasSuffix("'") || last.hasSuffix("’") { return base + 1.2 }
        // A lone word ("Bonjour") is often the start of more.
        if trimmed.split(separator: " ").count == 1 { return base + 0.5 }
        return base
    }
}
