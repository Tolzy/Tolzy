import Foundation

/// Turns recognised speech (a punctuated string plus per-word timings) into
/// short, timed sentences — the unit the transcript plays and translates.
enum SentenceSplitter {
    /// One recognised word with its timing in the media, in seconds.
    struct Word: Equatable {
        var text: String
        var start: Double
        var duration: Double
    }

    /// Sentences longer than this are broken up (at a comma when possible),
    /// because unpunctuated speech often arrives as one long run.
    static let preferredMaxWords = 16
    static let minWordsBeforeCommaBreak = 7

    static func split(formatted: String, words: [Word]) -> [TranscriptionResult.Segment] {
        var segments: [TranscriptionResult.Segment] = []
        var cursor = 0
        for sentence in sentences(in: formatted) {
            for chunk in chunks(of: sentence.split(whereSeparator: \.isWhitespace).map(String.init)) {
                let count = chunk.count
                var start = 0.0
                var end = 0.0
                if !words.isEmpty {
                    let first = words[min(cursor, words.count - 1)]
                    let last = words[min(cursor + count - 1, words.count - 1)]
                    start = first.start
                    end = max(last.start + last.duration, start)
                }
                cursor += count
                segments.append(.init(start: start, end: end, text: chunk.joined(separator: " ")))
            }
        }
        return segments
    }

    /// Segments for any transcript: recognised ones as-is, pasted text split
    /// into sentences without timings.
    static func segments(for transcript: TranscriptionResult) -> [TranscriptionResult.Segment] {
        transcript.segments.isEmpty ? split(formatted: transcript.text, words: []) : transcript.segments
    }

    /// Splits after `.`, `!`, `?` or `…` when followed by whitespace or the end.
    static func sentences(in text: String) -> [String] {
        let terminators: Set<Character> = [".", "!", "?", "…"]
        var result: [String] = []
        var current = ""
        let characters = Array(text)
        for (index, character) in characters.enumerated() {
            current.append(character)
            guard terminators.contains(character) else { continue }
            let next = index + 1 < characters.count ? characters[index + 1] : nil
            if next == nil || next!.isWhitespace {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { result.append(trimmed) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rest.isEmpty { result.append(rest) }
        // A lone "!" or "?" (French spacing) belongs to the previous sentence.
        return result.reduce(into: [String]()) { merged, sentence in
            if sentence.count <= 2, sentence.allSatisfy({ terminators.contains($0) }), let last = merged.popLast() {
                merged.append(last + " " + sentence)
            } else {
                merged.append(sentence)
            }
        }
    }

    private static func chunks(of tokens: [String]) -> [[String]] {
        guard tokens.count > preferredMaxWords else { return tokens.isEmpty ? [] : [tokens] }
        var chunks: [[String]] = []
        var current: [String] = []
        for token in tokens {
            current.append(token)
            let atComma = token.hasSuffix(",") && current.count >= minWordsBeforeCommaBreak
            if atComma || current.count >= preferredMaxWords {
                chunks.append(current)
                current = []
            }
        }
        if !current.isEmpty {
            // Don't leave a tiny tail on its own.
            if current.count < 3, var last = chunks.popLast() {
                last.append(contentsOf: current)
                chunks.append(last)
            } else {
                chunks.append(current)
            }
        }
        return chunks
    }
}
