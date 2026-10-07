import Foundation

/// What a speaking practice conversation is about.
struct PracticeScenario: Identifiable, Hashable, Codable {
    var id: String
    var title: String
    var subtitle: String
    var systemImage: String
    /// For the tutor: the situation and what to practise, in English.
    var goal: String
    /// Words the tutor should try to bring in.
    var vocabulary: [String] = []

    static let freeChat = PracticeScenario(
        id: "free", title: "Free conversation", subtitle: "Talk about anything",
        systemImage: "bubble.left.and.bubble.right",
        goal: "A relaxed everyday conversation. Ask the learner about themselves, their day and their interests."
    )
    static let cafe = PracticeScenario(
        id: "cafe", title: "At the café", subtitle: "Order a drink and a croissant",
        systemImage: "cup.and.saucer",
        goal: "You are a friendly waiter in a Paris café. The learner is a customer ordering drinks and food and asking for the bill.",
        vocabulary: ["un café", "un croissant", "l'addition", "s'il vous plaît", "je voudrais"]
    )
    static let introductions = PracticeScenario(
        id: "intro", title: "Introduce yourself", subtitle: "Name, work, where you live",
        systemImage: "person.wave.2",
        goal: "You are meeting the learner for the first time at a party. Ask their name, where they live, what they do and what they like.",
        vocabulary: ["je m'appelle", "j'habite", "je travaille", "j'aime"]
    )
    static let weekend = PracticeScenario(
        id: "weekend", title: "Your weekend", subtitle: "Practise the passé composé",
        systemImage: "calendar",
        goal: "Ask the learner what they did last weekend and what they will do next weekend. Encourage the passé composé and the futur proche.",
        vocabulary: ["je suis allé", "j'ai fait", "je vais"]
    )
    static let directions = PracticeScenario(
        id: "directions", title: "Asking the way", subtitle: "Find the station in a new town",
        systemImage: "map",
        goal: "You are a local in a French town. The learner is lost and asks how to get to the train station, a pharmacy and a bakery.",
        vocabulary: ["où est", "à gauche", "à droite", "tout droit", "la gare"]
    )

    static let builtIn: [PracticeScenario] = [freeChat, cafe, introductions, weekend, directions]

    /// Practise speaking about a lesson's video, reusing its words.
    static func about(_ lesson: Lesson) -> PracticeScenario {
        let transcript = lesson.analysis.transcript.text
            .split(whereSeparator: \.isWhitespace).prefix(90).joined(separator: " ")
        return PracticeScenario(
            id: "lesson-\(lesson.id.uuidString)",
            title: "About “\(lesson.analysis.title)”",
            subtitle: "Talk about the video you studied",
            systemImage: "play.rectangle",
            goal: "The learner just studied a short French video. Here is what was said: \"\(transcript)\". Talk with the learner about it: what happens, what they think, and their own experience of the topic.",
            vocabulary: Array((lesson.analysis.vocabulary.map(\.french) + lesson.analysis.expressions.map(\.phrase)).prefix(6))
        )
    }
}

/// One tutor turn: a French reply, its translation, and feedback on what
/// the learner just said.
struct TutorReply: Equatable {
    /// The tutor's answer, in French.
    var french: String
    var english: String
    /// A more natural version of the learner's last message, or empty when it was fine.
    var correction: String
    /// One short tip explaining the correction, in English.
    var tip: String

    static let empty = TutorReply(french: "", english: "", correction: "", tip: "")
}

struct ChatMessage: Identifiable, Equatable {
    enum Role: Equatable { case tutor, learner }

    let id: UUID
    var role: Role
    var text: String
    /// Tutor messages: the English translation.
    var english: String = ""
    /// Learner messages: the tutor's suggested correction.
    var correction: String = ""
    var tip: String = ""
    var isStreaming = false
    var wasSpoken = false

    init(id: UUID = UUID(), role: Role, text: String, english: String = "", isStreaming: Bool = false, wasSpoken: Bool = false) {
        self.id = id
        self.role = role
        self.text = text
        self.english = english
        self.isStreaming = isStreaming
        self.wasSpoken = wasSpoken
    }
}

/// Generates tutor replies. On-device (Apple Intelligence) or scripted.
protocol TutorEngine: AnyObject {
    /// Replies to the learner, or opens the conversation when `learnerText` is nil.
    /// `onPartial` receives the reply as it is being written.
    func respond(
        to learnerText: String?,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply

    /// Whether replies come from a real model (vs. samples).
    var isLive: Bool { get }
}

extension TutorReply {
    /// Whether a suggested correction changes more than accents, capitals and
    /// punctuation (which don't matter when speaking).
    static func isMeaningfulCorrection(_ correction: String, of original: String) -> Bool {
        let fixed = spokenForm(correction)
        return !fixed.isEmpty && fixed != spokenForm(original)
    }

    static func spokenForm(_ text: String) -> String {
        let folded = text
            .replacingOccurrences(of: "’", with: "'")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "fr_FR"))
        let kept = folded.unicodeScalars.map { scalar -> Character in
            CharacterSet.letters.contains(scalar) || CharacterSet.decimalDigits.contains(scalar) || scalar == "'"
                ? Character(scalar) : " "
        }
        return String(kept).split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
