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
        let prompt = learnerText.map(TutorPrompt.turn) ?? TutorPrompt.opening(for: scenario)

        let reply: TutorReply
        do {
            reply = try await stream(prompt, onPartial: onPartial)
        } catch let error as LanguageModelSession.GenerationError {
            switch error {
            case .exceededContextWindowSize:
                // Start over with the gist of the conversation, then retry once.
                session = LanguageModelSession(
                    instructions: TutorPrompt.instructions(level: level, scenario: scenario) + TutorPrompt.recap(history)
                )
                do {
                    reply = try await stream(prompt, onPartial: onPartial)
                } catch is LanguageModelSession.GenerationError {
                    throw AIServiceError.invalidResponse
                }
            case .guardrailViolation:
                throw AIServiceError.contentBlocked
            default:
                throw AIServiceError.invalidResponse
            }
        }

        history.append((learner: learnerText ?? "", tutor: reply.french))
        return reply
    }

    private func stream(
        _ prompt: String,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply {
        var latest = TutorReply.empty
        let stream = session.streamResponse(to: prompt, generating: GeneratedTutorTurn.self)
        for try await snapshot in stream {
            let partial = snapshot.content
            latest = TutorReply(
                french: partial.reply ?? "",
                english: partial.translation ?? "",
                correction: partial.correction ?? "",
                tip: partial.tip ?? ""
            )
            await onPartial(latest)
        }
        latest = Self.cleaned(latest)
        guard !latest.french.isEmpty else { throw AIServiceError.invalidResponse }
        return latest
    }

    /// The model sometimes "corrects" a message into itself; drop those.
    static func cleaned(_ reply: TutorReply) -> TutorReply {
        var reply = reply
        reply.french = reply.french.trimmingCharacters(in: .whitespacesAndNewlines)
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
