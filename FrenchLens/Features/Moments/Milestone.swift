import Foundation

/// A moment worth celebrating: something the learner actually did, never
/// points for opening the app.
enum Milestone: String, CaseIterable, Codable, Identifiable {
    case firstLesson
    case firstReel
    case firstChat
    case firstVoiceChat
    case realConversation
    case firstCorrection
    case words25
    case words100
    case firstReview
    case perfectReview
    case levelUp
    case sevenDays

    var id: String { rawValue }

    var title: String {
        switch self {
        case .firstLesson: "Your first lesson"
        case .firstReel: "Your first Reel"
        case .firstChat: "Your first chat with Camille"
        case .firstVoiceChat: "Your first voice conversation"
        case .realConversation: "A real conversation"
        case .firstCorrection: "Corrected & improved"
        case .words25: "25 words collected"
        case .words100: "100 words collected"
        case .firstReview: "Your first review"
        case .perfectReview: "A perfect review"
        case .levelUp: "Level up"
        case .sevenDays: "7 days of French"
        }
    }

    /// What it means, shown under the title.
    var message: String {
        switch self {
        case .firstLesson: "You turned real French into a lesson."
        case .firstReel: "You learned from a Reel as it played."
        case .firstChat: "You started talking with Camille."
        case .firstVoiceChat: "You spoke French out loud — and were understood."
        case .realConversation: "Ten back-and-forths in French. That's a conversation."
        case .firstCorrection: "You found a more natural way to say it."
        case .words25: "Your vocabulary is growing, one video at a time."
        case .words100: "A hundred words you met in the wild."
        case .firstReview: "You came back to what you learned."
        case .perfectReview: "Every single card, right."
        case .levelUp: "Your French has moved up a level."
        case .sevenDays: "French has become part of your week."
        }
    }

    /// How to earn it, for the gallery.
    var hint: String {
        switch self {
        case .firstLesson: "Turn a French video into a lesson"
        case .firstReel: "Use Listen while you watch on a Reel"
        case .firstChat: "Say something to Camille"
        case .firstVoiceChat: "Talk with Camille in voice mode"
        case .realConversation: "Keep one conversation going for 10 turns"
        case .firstCorrection: "Get a “More natural” suggestion"
        case .words25: "Save lessons with 25 words between them"
        case .words100: "Save lessons with 100 words between them"
        case .firstReview: "Finish a review"
        case .perfectReview: "Get every card right in a review of 5 or more"
        case .levelUp: "Move up a level in Settings"
        case .sevenDays: "Practise on 7 different days"
        }
    }

    var systemImage: String {
        switch self {
        case .firstLesson: "sparkles.rectangle.stack"
        case .firstReel: "play.rectangle.on.rectangle"
        case .firstChat: "bubble.left.and.bubble.right.fill"
        case .firstVoiceChat: "waveform"
        case .realConversation: "person.2.wave.2.fill"
        case .firstCorrection: "wand.and.sparkles"
        case .words25: "character.book.closed.fill"
        case .words100: "books.vertical.fill"
        case .firstReview: "rectangle.on.rectangle.angled"
        case .perfectReview: "checkmark.seal.fill"
        case .levelUp: "chart.line.uptrend.xyaxis"
        case .sevenDays: "calendar"
        }
    }
}

/// Something that happened, reported by the feature that saw it.
enum MilestoneEvent: Equatable {
    case lessonCreated(title: String, fromReel: Bool)
    /// A conversation with Camille ended (the learner left it).
    case conversationEnded(exchanges: Int, voiceTurns: Int, firstLine: String?, scenario: String)
    case correctionReceived(original: String, corrected: String)
    case savedWords(count: Int)
    case reviewFinished(correct: Int, total: Int)
    case levelChanged(from: CEFRLevel, to: CEFRLevel)
    case activeDays(count: Int)
}

/// The rules: which events unlock which moments, and the personal detail
/// each card shows. Pure, so it can be tested.
enum MilestoneRules {
    static let realConversationExchanges = 10
    static let perfectReviewMinimum = 5

    static func unlocks(for event: MilestoneEvent, alreadyUnlocked: Set<Milestone>) -> [(Milestone, String)] {
        var found: [(Milestone, String)] = []
        func add(_ milestone: Milestone, _ detail: String) {
            guard !alreadyUnlocked.contains(milestone), !found.contains(where: { $0.0 == milestone }) else { return }
            found.append((milestone, detail))
        }

        switch event {
        case .lessonCreated(let title, let fromReel):
            add(.firstLesson, "“\(title)”")
            if fromReel { add(.firstReel, "“\(title)”") }

        case .conversationEnded(let exchanges, let voiceTurns, let firstLine, let scenario):
            guard exchanges > 0 else { break }
            let quote = firstLine.map { "You said: “\(shortened($0))”" } ?? scenario
            add(.firstChat, quote)
            if voiceTurns > 0 { add(.firstVoiceChat, quote) }
            if exchanges >= realConversationExchanges {
                add(.realConversation, "\(exchanges) exchanges · \(scenario)")
            }

        case .correctionReceived(let original, let corrected):
            add(.firstCorrection, "“\(shortened(original))” → “\(shortened(corrected))”")

        case .savedWords(let count):
            if count >= 25 { add(.words25, "\(count) words in your library") }
            if count >= 100 { add(.words100, "\(count) words in your library") }

        case .reviewFinished(let correct, let total):
            guard total > 0 else { break }
            add(.firstReview, "\(correct) of \(total) right")
            if correct == total, total >= perfectReviewMinimum { add(.perfectReview, "\(total) of \(total) right") }

        case .levelChanged(let from, let to):
            // Level up is earned once; going down never takes it away.
            if to > from { add(.levelUp, "\(from.rawValue) → \(to.rawValue)") }

        case .activeDays(let count):
            if count >= 7 { add(.sevenDays, "\(count) days with FrenchLens") }
        }
        return found
    }

    static func shortened(_ text: String, limit: Int = 60) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > limit else { return trimmed }
        return String(trimmed.prefix(limit - 1)).trimmingCharacters(in: .whitespaces) + "…"
    }
}
