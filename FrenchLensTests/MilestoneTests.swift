import XCTest
@testable import FrenchLens

final class MilestoneRulesTests: XCTestCase {
    private func unlocks(_ event: MilestoneEvent, _ already: Set<Milestone> = []) -> [Milestone] {
        MilestoneRules.unlocks(for: event, alreadyUnlocked: already).map(\.0)
    }

    func testLessons() {
        XCTAssertEqual(unlocks(.lessonCreated(title: "Au marché", fromReel: false)), [.firstLesson])
        XCTAssertEqual(unlocks(.lessonCreated(title: "Au marché", fromReel: true)), [.firstLesson, .firstReel])
        XCTAssertEqual(unlocks(.lessonCreated(title: "Au marché", fromReel: true), [.firstLesson]), [.firstReel])
    }

    func testConversations() {
        XCTAssertEqual(unlocks(.conversationEnded(exchanges: 0, voiceTurns: 0, firstLine: nil, scenario: "Café")), [],
                       "Opening a chat and leaving isn't a conversation")
        XCTAssertEqual(unlocks(.conversationEnded(exchanges: 2, voiceTurns: 0, firstLine: "Bonjour", scenario: "Café")), [.firstChat])
        XCTAssertEqual(unlocks(.conversationEnded(exchanges: 10, voiceTurns: 3, firstLine: "Bonjour", scenario: "Café")),
                       [.firstChat, .firstVoiceChat, .realConversation])
        let detail = MilestoneRules.unlocks(
            for: .conversationEnded(exchanges: 1, voiceTurns: 1, firstLine: "Bonjour, moi c'est Tosin", scenario: "Free"),
            alreadyUnlocked: [.firstChat]
        ).first?.1
        XCTAssertEqual(detail, "You said: “Bonjour, moi c'est Tosin”")
    }

    func testWordsReviewsLevelsAndDays() {
        XCTAssertEqual(unlocks(.savedWords(count: 24)), [])
        XCTAssertEqual(unlocks(.savedWords(count: 30)), [.words25])
        XCTAssertEqual(unlocks(.savedWords(count: 120)), [.words25, .words100])

        XCTAssertEqual(unlocks(.reviewFinished(correct: 3, total: 6)), [.firstReview])
        XCTAssertEqual(unlocks(.reviewFinished(correct: 6, total: 6)), [.firstReview, .perfectReview])
        XCTAssertEqual(unlocks(.reviewFinished(correct: 3, total: 3)), [.firstReview], "Too short to be a perfect review")

        XCTAssertEqual(unlocks(.levelChanged(from: .a1, to: .a2)), [.levelUp])
        XCTAssertEqual(unlocks(.levelChanged(from: .a2, to: .a1)), [])
        XCTAssertEqual(unlocks(.activeDays(count: 6)), [])
        XCTAssertEqual(unlocks(.activeDays(count: 7)), [.sevenDays])
    }

    func testLongQuotesAreShortened() {
        let long = String(repeating: "très ", count: 30)
        XCTAssertLessThanOrEqual(MilestoneRules.shortened(long).count, 60)
        XCTAssertTrue(MilestoneRules.shortened(long).hasSuffix("…"))
    }
}

@MainActor
final class MilestoneStoreTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        let name = "MilestoneStoreTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return defaults
    }

    func testEachMomentIsCelebratedOnceAndRemembered() async {
        let defaults = makeDefaults()
        let store = MilestoneStore(defaults: defaults)
        store.record(.lessonCreated(title: "Au marché", fromReel: true))
        XCTAssertEqual(store.pending.map(\.milestone), [.firstLesson, .firstReel])
        store.record(.lessonCreated(title: "Encore", fromReel: true))
        XCTAssertEqual(store.pending.count, 2, "Never twice")

        store.dismissCurrent()
        XCTAssertEqual(store.next?.milestone, .firstReel)

        let reopened = MilestoneStore(defaults: defaults)
        XCTAssertEqual(Set(reopened.unlocked.keys), [.firstLesson, .firstReel])
        XCTAssertTrue(reopened.pending.isEmpty, "Only new moments are celebrated")
        XCTAssertEqual(reopened.unlocked[.firstLesson]?.detail, "“Au marché”")
    }

    func testSevenDifferentDaysUnlockOnce() async {
        let store = MilestoneStore(defaults: makeDefaults())
        let calendar = Calendar(identifier: .gregorian)
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        for day in 0..<7 {
            store.recordActiveDay(start.addingTimeInterval(Double(day) * 86_400), calendar: calendar)
            store.recordActiveDay(start.addingTimeInterval(Double(day) * 86_400 + 60), calendar: calendar)
        }
        XCTAssertEqual(store.pending.map(\.milestone), [.sevenDays])
    }

    func testHoldsAndDisabledStore() async {
        let store = MilestoneStore(defaults: makeDefaults())
        store.hold("conversation")
        XCTAssertTrue(store.isHeld)
        store.release("conversation")
        XCTAssertFalse(store.isHeld)

        let quiet = MilestoneStore(defaults: makeDefaults(), isEnabled: false)
        quiet.record(.reviewFinished(correct: 1, total: 2))
        XCTAssertTrue(quiet.pending.isEmpty)
        XCTAssertNotNil(quiet.unlocked[.firstReview], "Still earned, just not shown")
    }
}
