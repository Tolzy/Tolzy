import Foundation

/// The learner's name as written, and as the French voice should say it.
struct LearnerName: Equatable {
    var written: String
    var spoken: String
}

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

    /// French reading rules mangle many names: a single "s" between vowels
    /// becomes "z" (Tosin → "Tozin"), a final "-in"/"-an"/"-on" turns nasal,
    /// "u" becomes the French "u". This respells a name so a French voice
    /// says it as it's usually said in English and many African languages:
    /// Tosin → Tossine, Tunde → Toundé, Bukola → Boukola, Ade → Adé.
    static func frenchRespelling(of name: String) -> String {
        let vowels = Set("aeiouyAEIOUYéèê")
        let chars = Array(name)
        var result = ""
        for (i, c) in chars.enumerated() {
            let prev = i > 0 ? chars[i - 1] : nil
            let next = i + 1 < chars.count ? chars[i + 1] : nil
            switch c {
            case "s" where prev.map(vowels.contains) == true && next.map(vowels.contains) == true:
                result += "ss"
            case "u" where prev != "o" && prev != "O" && prev != "e" && prev != "a":
                result += "ou"
            case "U" where i == 0:
                result += "Ou"
            default:
                result.append(c)
            }
        }
        let lower = result.lowercased()
        // A final vowel + n would be nasal: Tossin → Tossine.
        if lower.count >= 3, lower.hasSuffix("n"), let v = lower.dropLast().last, vowels.contains(v) {
            result += "e"
        } else if lower.count >= 3, lower.hasSuffix("e"), let before = lower.dropLast().last, !vowels.contains(before) {
            // A final silent e would be dropped: Ade → Adé.
            result = String(result.dropLast()) + "é"
        }
        return result
    }

    /// Speech recognition often mishears an unfamiliar name. When the
    /// learner introduces themselves ("moi c'est …", "je m'appelle …") and
    /// the heard word isn't their saved name, put the name back.
    static func correctingName(in text: String, to name: String) -> String {
        guard !name.isEmpty, let heard = self.name(in: text),
              heard.compare(name, options: [.caseInsensitive, .diacriticInsensitive]) != .orderedSame,
              let range = text.range(of: heard, options: [.caseInsensitive])
        else { return text }
        return text.replacingCharacters(in: range, with: name)
    }

    /// Replaces the written name with its spoken respelling, for the voice.
    static func spoken(_ text: String, name: LearnerName?) -> String {
        guard let name, name.spoken != name.written, !name.written.isEmpty else { return text }
        let pattern = "(?i)(?<![\\p{L}])" + NSRegularExpression.escapedPattern(for: name.written) + "(?![\\p{L}])"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return text }
        return regex.stringByReplacingMatches(
            in: text, range: NSRange(text.startIndex..., in: text),
            withTemplate: NSRegularExpression.escapedTemplate(for: name.spoken)
        )
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
