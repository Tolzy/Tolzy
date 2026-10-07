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
        XCTAssertFalse(TutorPrompt.instructions(level: .b2, scenario: .freeChat).contains("Try to use"))
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

final class ScriptedTutorTests: XCTestCase {
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
            scenario: .freeChat, engine: ScriptedTutor(scenario: .freeChat, delay: .zero), tts: tts
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
