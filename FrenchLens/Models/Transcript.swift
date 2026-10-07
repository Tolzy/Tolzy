import Foundation

struct Transcript: Codable, Hashable {
    var segments: [TranscriptSegment]

    var text: String { segments.map(\.text).joined(separator: " ") }

    /// The segment playing at `time` seconds, if timings are known.
    func segment(at time: Double) -> TranscriptSegment? {
        segments.first { segment in
            guard let start = segment.start, let end = segment.end else { return false }
            return time >= start && time < end
        }
    }
}

/// One spoken sentence or phrase.
struct TranscriptSegment: Codable, Hashable, Identifiable {
    var id: String
    /// Seconds from the start of the media, when known.
    var start: Double?
    var end: Double?
    var tokens: [TranscriptToken]
    /// Natural English for this sentence.
    var translation: String?

    /// The sentence as spoken. Tokens are separated by single spaces.
    var text: String { tokens.map(\.text).joined(separator: " ") }

    /// UTF-16 offset where each token starts in `text` — used to map speech
    /// synthesiser ranges (`NSRange`) back to tokens.
    var tokenOffsets: [Int] {
        var offsets: [Int] = []
        var cursor = 0
        for token in tokens {
            offsets.append(cursor)
            cursor += token.text.utf16.count + 1
        }
        return offsets
    }

    /// Index of the token containing UTF-16 `location`.
    func tokenIndex(atUTF16Offset location: Int) -> Int? {
        let offsets = tokenOffsets
        for (index, start) in offsets.enumerated().reversed() where location >= start {
            return index
        }
        return nil
    }
}

/// A word (with attached punctuation) as displayed in the transcript.
struct TranscriptToken: Codable, Hashable {
    var text: String
    /// Key into `LessonAnalysis.glossary`. `nil` means the word is not tappable.
    var lookup: String?

    init(_ text: String, lookup: String? = nil) {
        self.text = text
        self.lookup = lookup
    }

    private enum CodingKeys: String, CodingKey { case text, lookup }

    /// Tokens may be encoded compactly as a bare string.
    init(from decoder: Decoder) throws {
        if let bare = try? decoder.singleValueContainer().decode(String.self) {
            self.init(bare)
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            try container.decode(String.self, forKey: .text),
            lookup: try container.decodeIfPresent(String.self, forKey: .lookup)
        )
    }

    func encode(to encoder: Encoder) throws {
        if let lookup {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(text, forKey: .text)
            try container.encode(lookup, forKey: .lookup)
        } else {
            var container = encoder.singleValueContainer()
            try container.encode(text)
        }
    }

    var isTappable: Bool { lookup != nil }
}
