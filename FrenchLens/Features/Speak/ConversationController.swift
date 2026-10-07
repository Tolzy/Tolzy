import Foundation
import Observation

/// One practice conversation: the messages, the tutor's streaming reply,
/// feedback attached to what the learner said, and speaking replies aloud.
@MainActor
@Observable
final class ConversationController {
    let scenario: PracticeScenario
    private(set) var messages: [ChatMessage] = []
    private(set) var isResponding = false
    private(set) var errorMessage: String?
    /// The learner message to retry after an error.
    @ObservationIgnored private var pendingLearnerText: String?

    var autoSpeak = true
    /// The learner's saved name: repairs misheard introductions and tells
    /// the voice how to say it.
    @ObservationIgnored var learnerName: LearnerName?
    var showsEnglish = false

    @ObservationIgnored private let engine: TutorEngine
    /// Injected from the environment when the conversation appears.
    @ObservationIgnored var tts: any TTSService
    @ObservationIgnored private var responseTask: Task<Void, Never>?

    var isLive: Bool { engine.isLive }
    var hasLearnerMessages: Bool { messages.contains { $0.role == .learner } }

    init(scenario: PracticeScenario, engine: TutorEngine, tts: any TTSService = SilentTTSService()) {
        self.scenario = scenario
        self.engine = engine
        self.tts = tts
    }

    /// The tutor opens the conversation, unless it's the learner's to start.
    func start() {
        guard messages.isEmpty, !isResponding, !scenario.learnerOpens else { return }
        respond(to: nil)
    }

    func send(_ text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isResponding else { return }
        tts.stop()
        let heard = repairingName(in: text)
        messages.append(ChatMessage(role: .learner, text: heard))
        respond(to: heard)
    }

    /// Puts the learner's saved name back where recognition misheard it.
    /// Used for live captions too, so the wrong name never flashes up.
    func repairingName(in text: String) -> String {
        learnerName.map { ConversationFlow.correctingName(in: text, to: $0.written) } ?? text
    }

    func retry() {
        guard errorMessage != nil else { return }
        respond(to: pendingLearnerText)
    }

    func speak(_ message: ChatMessage) {
        let id = Self.speechID(message)
        if tts.isSpeaking(id) {
            tts.stop()
        } else {
            let text = message.role == .tutor ? message.text : (message.correction.isEmpty ? message.text : message.correction)
            tts.speak(ConversationFlow.spoken(text, name: learnerName), id: id, rate: .normal)
        }
    }

    func isSpeaking(_ message: ChatMessage) -> Bool {
        tts.isSpeaking(Self.speechID(message))
    }

    /// Waits for the reply being written (and its speech to start).
    func waitForReply() async {
        await responseTask?.value
    }

    func stop() {
        responseTask?.cancel()
        responseTask = nil
        tts.stop()
    }

    static func speechID(_ message: ChatMessage) -> String { "chat.\(message.id.uuidString)" }

    // MARK: Replying

    private func respond(to learnerText: String?) {
        errorMessage = nil
        pendingLearnerText = learnerText
        isResponding = true

        let tutorID = UUID()
        messages.append(ChatMessage(id: tutorID, role: .tutor, text: "", isStreaming: true))
        let learnerID = learnerText == nil ? nil : messages.last(where: { $0.role == .learner })?.id

        responseTask = Task { [weak self, engine] in
            do {
                let reply = try await engine.respond(to: learnerText) { partial in
                    self?.update(tutorID, with: partial, learnerID: learnerID, isFinal: false)
                }
                guard let self, !Task.isCancelled else { return }
                self.update(tutorID, with: reply, learnerID: learnerID, isFinal: true)
                self.isResponding = false
                self.pendingLearnerText = nil
                if self.autoSpeak, let message = self.messages.first(where: { $0.id == tutorID }) {
                    self.tts.speak(ConversationFlow.spoken(message.text, name: self.learnerName), id: Self.speechID(message), rate: .normal)
                }
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.messages.removeAll { $0.id == tutorID }
                self.isResponding = false
                self.errorMessage = Self.message(for: error)
            }
        }
    }

    private func update(_ tutorID: UUID, with reply: TutorReply, learnerID: UUID?, isFinal: Bool) {
        if let index = messages.firstIndex(where: { $0.id == tutorID }) {
            messages[index].text = reply.french
            messages[index].english = reply.english
            messages[index].isStreaming = !isFinal
        }
        // Feedback appears under the learner's message once it's complete.
        if isFinal, let learnerID, let index = messages.firstIndex(where: { $0.id == learnerID }),
           TutorReply.isMeaningfulCorrection(reply.correction, of: messages[index].text) {
            messages[index].correction = reply.correction
            messages[index].tip = reply.tip
        }
    }

    private static func message(for error: Error) -> String {
        switch error {
        case AIServiceError.modelUnavailable(let message): message
        case AIServiceError.contentBlocked: "Camille can't reply to that. Try saying something else."
        default: "Camille didn't catch that. Try again."
        }
    }
}
