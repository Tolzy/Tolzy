import XCTest
@testable import FrenchLens

final class TutorFeedbackTests: XCTestCase {
    func testClassicSlipsAreCorrected() {
        XCTAssertEqual(ScriptedTutor.correction(for: "Je va au cinéma")?.corrected, "Je vais au cinéma")
        XCTAssertEqual(ScriptedTutor.correction(for: "j'ai allé à Paris")?.corrected, "Je suis allé à Paris")
        XCTAssertEqual(ScriptedTutor.correction(for: "Je suis 20 ans")?.corrected, "J'ai 20 ans")
        XCTAssertEqual(ScriptedTutor.correction(for: "je suis faim")?.corrected, "J'ai faim")
    }

    func testCorrectFrenchIsLeftAlone() {
        XCTAssertNil(ScriptedTutor.correction(for: "Je vais bien, merci"))
        XCTAssertNil(ScriptedTutor.correction(for: "Je suis allé au marché"))
    }

    func testAccentsCapitalsAndPunctuationAreNotCorrections() {
        XCTAssertFalse(TutorReply.isMeaningfulCorrection("Ça va très bien !", of: "ca va tres bien"))
        XCTAssertFalse(TutorReply.isMeaningfulCorrection("J’ai faim.", of: "j'ai faim"))
        XCTAssertFalse(TutorReply.isMeaningfulCorrection("", of: "je va bien"))
        XCTAssertTrue(TutorReply.isMeaningfulCorrection("Je vais bien.", of: "je va bien"))
    }
}

final class TutorPromptTests: XCTestCase {
    func testInstructionsCarryLevelScenarioAndVocabulary() {
        let text = TutorPrompt.instructions(level: .a1, scenario: .cafe)
        XCTAssertTrue(text.contains("A1"))
        XCTAssertTrue(text.contains("waiter"))
        XCTAssertTrue(text.contains("l'addition"))
        XCTAssertFalse(TutorPrompt.instructions(level: .b2, scenario: .freeChat).contains("If it fits naturally"))
        XCTAssertTrue(text.contains("Greet only once"))
    }

    func testRecapKeepsOnlyTheLatestExchanges() {
        let history = (1...5).map { (learner: "learner \($0)", tutor: "tutor \($0)") }
        let recap = TutorPrompt.recap(history, keeping: 2)
        XCTAssertTrue(recap.contains("learner 4"))
        XCTAssertTrue(recap.contains("tutor 5"))
        XCTAssertFalse(recap.contains("learner 3"))
        XCTAssertEqual(TutorPrompt.recap([]), "")
    }

    func testLessonScenarioUsesTheLessonsWords() throws {
        let lesson = Lesson(source: LessonSource(kind: .text), analysis: Fixtures.analysis, origin: .backend)
        let scenario = PracticeScenario.about(lesson)
        XCTAssertTrue(scenario.goal.contains(lesson.analysis.transcript.segments.first?.text.prefix(10) ?? ""))
        XCTAssertLessThanOrEqual(scenario.vocabulary.count, 6)
        XCTAssertTrue(scenario.id.hasPrefix("lesson-"))
    }
}

final class ConversationFlowTests: XCTestCase {
    func testRemembersTheLearnersName() {
        XCTAssertEqual(ConversationFlow.name(in: "Bonjour, eh, je m'appelle Tosin, eh, comment ça va ?"), "Tosin")
        XCTAssertEqual(ConversationFlow.name(in: "moi c'est léa"), "Léa")
        XCTAssertEqual(ConversationFlow.name(in: "Mon prénom est Ada"), "Ada")
        XCTAssertEqual(ConversationFlow.name(in: "je m’appelle Tosin"), "Tosin")
        XCTAssertNil(ConversationFlow.name(in: "Comment ça va ?"))
        XCTAssertNil(ConversationFlow.name(in: "je m'appelle euh"))
    }

    func testGreetingIsDroppedAfterTheFirstExchange() {
        XCTAssertEqual(ConversationFlow.removingGreeting("Bonjour Tosin ! Ça va très bien, et toi ?"), "Ça va très bien, et toi ?")
        XCTAssertEqual(ConversationFlow.removingGreeting("Salut, tu fais quoi ce soir ?"), "Tu fais quoi ce soir ?")
        XCTAssertEqual(ConversationFlow.removingGreeting("Hello again! What are you doing tonight?", english: true), "What are you doing tonight?")
        // Not a greeting, or nothing after it: left alone.
        XCTAssertEqual(ConversationFlow.removingGreeting("Salutations à ta famille !"), "Salutations à ta famille !")
        XCTAssertEqual(ConversationFlow.removingGreeting("Bonjour !"), "Bonjour !")
        XCTAssertEqual(ConversationFlow.removingGreeting("Bonjour à toi aussi et à toute ta famille qui habite loin, ça va ?"),
                       "Bonjour à toi aussi et à toute ta famille qui habite loin, ça va ?")
        // While streaming, a lone greeting never flashes up.
        XCTAssertEqual(ConversationFlow.removingGreeting("Bonjour", isComplete: false), "")
        XCTAssertEqual(ConversationFlow.removingGreeting("Bonjour !", isComplete: false), "")
        XCTAssertEqual(ConversationFlow.removingGreeting("Bonjour ! Ça", isComplete: false), "Ça")
    }

    func testRepeatsAreDetected() {
        let earlier = ["Qu'est-ce que tu as fait aujourd'hui ?", "Tu aimes le cinéma ?"]
        XCTAssertTrue(ConversationFlow.isRepeat("Qu’est-ce que tu as fait aujourd’hui ?", of: earlier))
        XCTAssertFalse(ConversationFlow.isRepeat("Et tu travailles où ?", of: earlier))
        XCTAssertFalse(ConversationFlow.isRepeat("Oui", of: ["Oui"]), "Very short replies aren't loops")
    }

    func testHesitationGivesMoreTimeToFinish() {
        let base = 1.4
        XCTAssertEqual(ConversationFlow.silenceNeeded(after: "Je m'appelle Tosin et je suis étudiant.", base: base), base)
        XCTAssertGreaterThan(ConversationFlow.silenceNeeded(after: "Je m'appelle Tosin et euh", base: base), base + 1)
        XCTAssertGreaterThan(ConversationFlow.silenceNeeded(after: "Je travaille dans", base: base), base + 1)
        XCTAssertGreaterThan(ConversationFlow.silenceNeeded(after: "Bonjour,", base: base), base + 1)
        XCTAssertGreaterThan(ConversationFlow.silenceNeeded(after: "Bonjour", base: base), base)

        let now = Date()
        XCTAssertFalse(VoiceSession.shouldEndTurn(transcript: "Je suis allé au", lastChange: now.addingTimeInterval(-1.6), now: now))
        XCTAssertTrue(VoiceSession.shouldEndTurn(transcript: "Je suis allé au parc.", lastChange: now.addingTimeInterval(-1.6), now: now))
    }

    func testTurnPromptsKeepTheConversationFlowing() {
        let first = TutorPrompt.turn("Bonjour, je m'appelle Tosin", name: "Tosin", isFirstExchange: true)
        XCTAssertTrue(first.contains("Greet them back"))
        XCTAssertTrue(first.contains("Tosin"))

        let later = TutorPrompt.turn("J'aime le cinéma", name: "Tosin", lastReply: "Tu aimes quoi ?")
        XCTAssertTrue(later.contains("Do not greet them again"))
        XCTAssertTrue(later.contains("Tu aimes quoi ?"))
        XCTAssertTrue(TutorPrompt.recap([("a", "b")], name: "Tosin").contains("do not greet again"))
    }
}

final class ScriptedTutorTests: XCTestCase {
    func testRepliesToWhatTheLearnerSaidAndGreetsOnce() async throws {
        let tutor = ScriptedTutor(scenario: .freeChat, delay: .zero)
        let first = try await tutor.respond(to: "Bonjour, eh, je m'appelle Tosin, eh, comment ça va ?") { _ in }
        XCTAssertTrue(first.french.hasPrefix("Salut ! Enchantée, Tosin ! Ça va très bien, merci !"), first.french)
        XCTAssertFalse(TutorReply.spokenForm(first.french).contains("comment ca va"), "Doesn't ask back what was just asked")

        for line in ["Je suis étudiant", "J'aime le cinéma", "Oui, beaucoup"] {
            let reply = try await tutor.respond(to: line) { _ in }
            let lower = reply.french.lowercased()
            XCTAssertFalse(lower.hasPrefix("salut") || lower.hasPrefix("bonjour"), reply.french)
        }
    }

    func testOpensThenAdvancesThroughTheScript() async throws {
        let tutor = ScriptedTutor(scenario: .cafe, delay: .zero)
        let script = ScriptedTutor.script(for: .cafe)

        let opening = try await tutor.respond(to: nil) { _ in }
        XCTAssertEqual(opening.french, script[0].french)

        let second = try await tutor.respond(to: "Je voudrais un café") { _ in }
        XCTAssertEqual(second.french, script[1].french)
        XCTAssertEqual(second.correction, "")
    }

    func testStreamsPartialsAndAttachesCorrections() async throws {
        let tutor = ScriptedTutor(scenario: .freeChat, delay: .zero)
        _ = try await tutor.respond(to: nil) { _ in }

        let partials = await PartialRecorder()
        let reply = try await tutor.respond(to: "Je va bien") { partials.append($0) }
        XCTAssertEqual(reply.correction, "Je vais bien")
        XCTAssertFalse(reply.tip.isEmpty)
        let recorded = await partials.all
        XCTAssertGreaterThan(recorded.count, 1)
        XCTAssertEqual(recorded.last, reply)
    }
}

@MainActor
final class ConversationControllerTests: XCTestCase {
    func testTutorOpensAndCorrectionAttachesToLearnerMessage() async throws {
        let tts = RecordingTTS()
        let controller = ConversationController(
            scenario: .cafe, engine: ScriptedTutor(scenario: .cafe, delay: .zero), tts: tts
        )
        controller.start()
        try await waitUntil { !controller.isResponding }
        XCTAssertEqual(controller.messages.count, 1)
        XCTAssertEqual(controller.messages[0].role, .tutor)
        XCTAssertFalse(controller.messages[0].isStreaming)
        XCTAssertEqual(tts.spoken.count, 1, "Replies are read aloud")

        controller.send("je suis faim")
        try await waitUntil { !controller.isResponding }
        XCTAssertEqual(controller.messages.map(\.role), [.tutor, .learner, .tutor])
        XCTAssertEqual(controller.messages[1].correction, "J'ai faim")
        XCTAssertTrue(controller.hasLearnerMessages)
    }

    func testFailureShowsErrorAndRetryRecovers() async throws {
        let engine = FlakyTutor()
        let controller = ConversationController(scenario: .cafe, engine: engine, tts: RecordingTTS())
        controller.start()
        try await waitUntil { !controller.isResponding }
        XCTAssertNotNil(controller.errorMessage)
        XCTAssertTrue(controller.messages.isEmpty)

        controller.retry()
        try await waitUntil { !controller.isResponding }
        XCTAssertNil(controller.errorMessage)
        XCTAssertEqual(controller.messages.first?.text, "Bonjour !")
    }

    func testIgnoresEmptyMessages() async throws {
        let controller = ConversationController(
            scenario: .freeChat, engine: ScriptedTutor(scenario: .freeChat, delay: .zero), tts: RecordingTTS()
        )
        controller.send("   ")
        XCTAssertTrue(controller.messages.isEmpty)
    }

    func testFreeConversationWaitsForTheLearner() async throws {
        let controller = ConversationController(
            scenario: .freeChat, engine: ScriptedTutor(scenario: .freeChat, delay: .zero), tts: RecordingTTS()
        )
        controller.start()
        XCTAssertTrue(controller.messages.isEmpty)
        XCTAssertFalse(controller.isResponding)
    }

    private func waitUntil(_ condition: @MainActor () -> Bool) async throws {
        for _ in 0..<200 {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTFail("Timed out")
    }
}

// MARK: - Fakes

@MainActor
private final class PartialRecorder {
    private(set) var all: [TutorReply] = []
    func append(_ reply: TutorReply) { all.append(reply) }
}

private final class RecordingTTS: TTSService {
    var current: SpeechPlayback?
    var spoken: [String] = []
    func speak(_ text: String, id: String, rate: SpeechRate) { spoken.append(text) }
    func stop() { current = nil }
}

private final class FlakyTutor: TutorEngine {
    private var attempts = 0
    var isLive: Bool { true }

    func respond(
        to learnerText: String?,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply {
        attempts += 1
        if attempts == 1 { throw AIServiceError.invalidResponse }
        return TutorReply(french: "Bonjour !", english: "Hello!", correction: "", tip: "")
    }
}

@MainActor
final class VoiceSessionTests: XCTestCase {
    func testPauseEndsTheLearnersTurn() async {
        let now = Date()
        XCTAssertTrue(VoiceSession.shouldEndTurn(transcript: "Bonjour", lastChange: now.addingTimeInterval(-2), now: now))
        XCTAssertFalse(VoiceSession.shouldEndTurn(transcript: "Bonjour", lastChange: now.addingTimeInterval(-0.5), now: now))
        XCTAssertFalse(VoiceSession.shouldEndTurn(transcript: "  ", lastChange: .distantPast, now: now), "Silence alone never sends")
    }

    func testHandsFreeTurnTaking() async throws {
        // Free conversation: the learner speaks first.
        let listener = FakeListener(turns: ["je suis faim", "j'aime le cinéma"])
        let controller = ConversationController(
            scenario: .freeChat, engine: ScriptedTutor(scenario: .freeChat, delay: .zero), tts: RecordingTTS()
        )
        let session = VoiceSession(controller: controller, listener: listener)
        session.pollInterval = .milliseconds(5)
        session.start()

        try await waitUntil { controller.messages.count == 4 && !controller.isResponding }
        XCTAssertEqual(controller.messages.map(\.role), [.learner, .tutor, .learner, .tutor])
        XCTAssertEqual(controller.messages[0].text, "je suis faim")
        XCTAssertEqual(controller.messages[0].correction, "J'ai faim")
        try await waitUntil { session.phase == .listening }
        session.end()
        XCTAssertTrue(controller.autoSpeak)
    }

    func testMicIsOffWhileCamilleSpeaksAndTapInterrupts() async throws {
        let tts = SpeakingTTS()
        let listener = FakeListener(turns: [])
        let controller = ConversationController(
            scenario: .cafe, engine: ScriptedTutor(scenario: .cafe, delay: .zero), tts: tts
        )
        let session = VoiceSession(controller: controller, listener: listener)
        session.pollInterval = .milliseconds(5)
        session.start()

        try await waitUntil { session.phase == .speaking }
        XCTAssertEqual(listener.starts, 0, "Never listens while speaking")
        session.tap()
        try await waitUntil { session.phase == .listening }
        XCTAssertEqual(listener.starts, 1)
        session.end()
    }

    func testMuteStopsListening() async throws {
        let listener = FakeListener(turns: [])
        let controller = ConversationController(
            scenario: .cafe, engine: ScriptedTutor(scenario: .cafe, delay: .zero), tts: RecordingTTS()
        )
        let session = VoiceSession(controller: controller, listener: listener)
        session.pollInterval = .milliseconds(5)
        session.start()
        try await waitUntil { session.phase == .listening }

        session.toggleMute()
        XCTAssertEqual(session.phase, .muted)
        XCTAssertGreaterThan(listener.cancels, 0)
        session.toggleMute()
        try await waitUntil { session.phase == .listening }
        session.end()
    }

    func testMicrophoneProblemIsShown() async throws {
        let listener = FakeListener(turns: [])
        listener.errorMessage = "No microphone"
        let controller = ConversationController(
            scenario: .cafe, engine: ScriptedTutor(scenario: .cafe, delay: .zero), tts: RecordingTTS()
        )
        let session = VoiceSession(controller: controller, listener: listener)
        session.pollInterval = .milliseconds(5)
        session.start()
        try await waitUntil { session.phase == .failed("No microphone") }
        session.end()
    }

    private func waitUntil(_ condition: @MainActor () -> Bool) async throws {
        for _ in 0..<300 {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTFail("Timed out")
    }
}

/// Hears one scripted sentence per turn, said "a while ago" so the pause
/// has already happened.
@MainActor
private final class FakeListener: VoiceListening {
    var turns: [String]
    var transcript = ""
    var level: Double = 0
    var errorMessage: String?
    var lastChange = Date.distantPast
    var recognizerEnded = false
    var starts = 0
    var cancels = 0

    init(turns: [String]) { self.turns = turns }

    func start() async {
        starts += 1
        transcript = turns.isEmpty ? "" : turns.removeFirst()
        lastChange = .distantPast
    }

    func finish() async -> String {
        defer { transcript = "" }
        return transcript
    }

    func cancel() {
        cancels += 1
        transcript = ""
    }
}

/// Keeps "speaking" until stopped.
private final class SpeakingTTS: TTSService {
    var current: SpeechPlayback?
    func speak(_ text: String, id: String, rate: SpeechRate) {
        current = SpeechPlayback(utteranceID: id, rate: rate, range: nil)
    }
    func stop() { current = nil }
}
