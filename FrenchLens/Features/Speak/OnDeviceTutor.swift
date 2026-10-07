#if canImport(FoundationModels)
import Foundation
import FoundationModels

/// A live conversation partner running on the iPhone with Apple Intelligence.
/// One `LanguageModelSession` keeps the whole conversation in context; replies
/// stream in as they're written. When a long chat fills the model's memory,
/// a fresh session continues from a recap of the latest exchanges.
@available(iOS 26.0, *)
final class OnDeviceTutor: TutorEngine {
    private let level: CEFRLevel
    private let scenario: PracticeScenario
    private var session: LanguageModelSession
    private var history: [(learner: String, tutor: String)] = []
    /// Remembered across context resets.
    private var learnerName: String?

    var isLive: Bool { true }

    init(level: CEFRLevel, scenario: PracticeScenario) {
        self.level = level
        self.scenario = scenario
        session = LanguageModelSession(instructions: TutorPrompt.instructions(level: level, scenario: scenario))
        session.prewarm()
    }

    func respond(
        to learnerText: String?,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply {
        if case .unavailable(let reason) = SystemLanguageModel.default.availability {
            throw AIServiceError.modelUnavailable(OnDeviceCapability.message(for: OnDeviceCapability.status(for: reason)))
        }
        if let learnerText, let name = ConversationFlow.name(in: learnerText) { learnerName = name }
        // Camille greets once: when she opens, or when the learner opens.
        let greets = history.isEmpty
        let prompt: String
        if let learnerText {
            prompt = TutorPrompt.turn(learnerText, name: learnerName, lastReply: history.last?.tutor, isFirstExchange: history.isEmpty)
        } else {
            prompt = TutorPrompt.opening(for: scenario)
        }

        var reply = try await generate(prompt, greets: greets, onPartial: onPartial)
        // Small models sometimes loop; ask once for something new.
        if ConversationFlow.isRepeat(reply.french, of: history.map { $0.tutor }) {
            reply = try await generate(TutorPrompt.avoidRepeat(prompt), greets: greets, onPartial: onPartial)
        }

        history.append((learner: learnerText ?? "", tutor: reply.french))
        return reply
    }

    private func generate(
        _ prompt: String,
        greets: Bool,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply {
        do {
            return try await stream(prompt, greets: greets, onPartial: onPartial)
        } catch let error as LanguageModelSession.GenerationError {
            switch error {
            case .exceededContextWindowSize:
                // Start over with the gist of the conversation, then retry once.
                session = LanguageModelSession(
                    instructions: TutorPrompt.instructions(level: level, scenario: scenario)
                        + TutorPrompt.recap(history, name: learnerName)
                )
                do {
                    return try await stream(prompt, greets: greets, onPartial: onPartial)
                } catch is LanguageModelSession.GenerationError {
                    throw AIServiceError.invalidResponse
                }
            case .guardrailViolation:
                throw AIServiceError.contentBlocked
            default:
                throw AIServiceError.invalidResponse
            }
        }
    }

    private func stream(
        _ prompt: String,
        greets: Bool,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply {
        var latest = TutorReply.empty
        let stream = session.streamResponse(
            to: prompt,
            generating: GeneratedTutorTurn.self,
            options: GenerationOptions(temperature: 0.8)
        )
        for try await snapshot in stream {
            let partial = snapshot.content
            latest = TutorReply(
                french: partial.reply ?? "",
                english: partial.translation ?? "",
                correction: partial.correction ?? "",
                tip: partial.tip ?? ""
            )
            var shown = latest
            if !greets {
                shown.french = ConversationFlow.removingGreeting(shown.french, isComplete: false)
                shown.english = ""
            }
            await onPartial(shown)
        }
        latest = Self.cleaned(latest)
        if !greets {
            let french = ConversationFlow.removingGreeting(latest.french)
            if french != latest.french {
                latest.french = french
                latest.english = ConversationFlow.removingGreeting(latest.english, english: true)
            }
        }
        guard !latest.french.isEmpty else { throw AIServiceError.invalidResponse }
        return latest
    }

    /// The model sometimes "corrects" a message into itself; drop those.
    static func cleaned(_ reply: TutorReply) -> TutorReply {
        var reply = reply
        reply.french = reply.french.trimmingCharacters(in: .whitespacesAndNewlines)
        // "Camille : Ça va ?" → "Ça va ?"
        if reply.french.lowercased().hasPrefix("camille"),
           let colon = reply.french.firstIndex(of: ":"),
           reply.french.distance(from: reply.french.startIndex, to: colon) <= 9 {
            let rest = reply.french[reply.french.index(after: colon)...].trimmingCharacters(in: .whitespacesAndNewlines)
            if !rest.isEmpty { reply.french = rest }
        }
        reply.english = reply.english.trimmingCharacters(in: .whitespacesAndNewlines)
        reply.correction = reply.correction.trimmingCharacters(in: .whitespacesAndNewlines)
        reply.tip = reply.tip.trimmingCharacters(in: .whitespacesAndNewlines)
        if reply.correction.isEmpty { reply.tip = "" }
        return reply
    }
}

/// Feedback comes first so the model decides on it before writing its reply.
@available(iOS 26.0, *)
@Generable
struct GeneratedTutorTurn {
    @Guide(description: "A corrected, natural French version of the learner's whole last message, or an empty string if it was already correct or there is no message yet")
    var correction: String
    @Guide(description: "One very short tip in English explaining the correction, or an empty string")
    var tip: String
    @Guide(description: "Camille's reply in French: one to three short sentences ending with a question")
    var reply: String
    @Guide(description: "A natural English translation of the reply")
    var translation: String
}
#endif
