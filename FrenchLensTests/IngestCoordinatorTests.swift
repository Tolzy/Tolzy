import XCTest
@testable import FrenchLens

@MainActor
final class IngestCoordinatorTests: XCTestCase {
    private var store: LessonStore!
    private var media: FakeMedia!
    private var inbox: ShareInbox!
    private var ai: FakeAIService!
    private var coordinator: IngestCoordinator!

    override func setUp() async throws {
        store = LessonStore(directory: TestFiles.temporaryDirectory())
        media = FakeMedia()
        inbox = ShareInbox(rootURL: TestFiles.temporaryDirectory().appendingPathComponent("Inbox"))
        ai = FakeAIService(result: .success(Fixtures.analysis))
        let ai = self.ai!
        coordinator = IngestCoordinator(
            store: store,
            media: media,
            inbox: inbox,
            makeAIService: { ai },
            currentLevel: { .a2 }
        )
    }

    /// Writes a payload (and its media files) to the inbox like the extension does.
    private func enqueue(_ payload: SharedPayload, files: [String] = []) throws -> SharedPayload {
        let directory = try inbox.makeDirectory(for: payload.id)
        for name in files {
            try Data("media".utf8).write(to: directory.appendingPathComponent(name))
        }
        try inbox.save(payload)
        return payload
    }

    func testStartsIdle() async {
        XCTAssertEqual(coordinator.phase, .idle)
        XCTAssertFalse(coordinator.isPresenting)
    }

    func testSharedVideoBecomesLessonAndKeepsLink() async throws {
        let link = URL(string: "https://www.instagram.com/reel/abc/")!
        let payload = try enqueue(
            SharedPayload(videos: [SharedVideo(fileName: "reel.mp4", typeIdentifier: "public.mpeg-4")], urls: [SharedURL(url: link)]),
            files: ["reel.mp4"]
        )

        await coordinator.process(.payload(payload))

        guard case .ready(let id) = coordinator.phase else { return XCTFail("Expected ready, got \(coordinator.phase)") }
        let lesson = try XCTUnwrap(store.lesson(id: id))
        XCTAssertEqual(lesson.source.kind, .instagramReel)
        XCTAssertEqual(lesson.source.url, link)
        XCTAssertEqual(lesson.source.mediaFileName, "stored-reel.mp4")
        XCTAssertEqual(lesson.generatedForLevel, .a2)
        XCTAssertEqual(ai.inputs, [.media(media.mediaURL(named: "stored-reel.mp4"))])
        XCTAssertTrue(inbox.pendingPayloads().isEmpty, "Processed shares leave the inbox")
    }

    func testLinkOnlyShareFailsHonestlyThenAcceptsUpload() async throws {
        let link = URL(string: "https://www.instagram.com/reel/abc/")!
        let payload = try enqueue(SharedPayload(urls: [SharedURL(url: link)]))

        await coordinator.process(.payload(payload))

        XCTAssertEqual(coordinator.phase, .failed(.linkOnly(link, caption: nil)))
        XCTAssertEqual(coordinator.pendingLink, link)
        XCTAssertTrue(ai.inputs.isEmpty, "A link is never sent for analysis as if it were media")
        XCTAssertEqual(IngestError.linkOnly(link, caption: nil).title, "We received the Reel link, but couldn't access its audio.")

        // Upload fallback: the picked video is attached to the original link.
        let picked = media.directory.appendingPathComponent("picked.mov")
        await coordinator.process(.video(picked))

        guard case .ready(let id) = coordinator.phase else { return XCTFail("Expected ready") }
        XCTAssertEqual(store.lesson(id: id)?.source.url, link)
        XCTAssertNil(coordinator.pendingLink)
    }

    func testVideoWithoutAudio() async {
        media.hasAudio = false
        await coordinator.process(.video(URL(fileURLWithPath: "/tmp/silent.mov")))
        XCTAssertEqual(coordinator.phase, .failed(.noAudio))
        XCTAssertTrue(store.lessons.isEmpty)
    }

    func testNetworkFailureCanBeRetried() async {
        ai.result = .failure(APIError.transport(.notConnectedToInternet))
        await coordinator.process(.text("Je vais vous montrer"))
        XCTAssertEqual(coordinator.phase, .failed(.network))
        XCTAssertTrue(IngestError.network.canRetry)

        ai.result = .success(Fixtures.analysis)
        coordinator.retry()
        await waitUntil { if case .ready = self.coordinator.phase { return true } else { return false } }
        XCTAssertEqual(store.lessons.count, 1)
    }

    func testAIFailureMapsToAIError() async {
        ai.result = .failure(APIError.http(status: 500, message: nil))
        await coordinator.process(.text("Bonjour"))
        XCTAssertEqual(coordinator.phase, .failed(.aiFailure))
    }

    func testEmptyAndUnsupportedShares() async throws {
        await coordinator.process(.payload(try enqueue(SharedPayload())))
        XCTAssertEqual(coordinator.phase, .failed(.nothingShared))

        let image = SharedPayload(images: [SharedImage(fileName: "i.jpg", typeIdentifier: "public.jpeg")])
        await coordinator.process(.payload(try enqueue(image, files: ["i.jpg"])))
        XCTAssertEqual(coordinator.phase, .failed(.unsupportedContent("an image")))
    }

    func testPastedTextWithoutLink() async {
        await coordinator.process(.link("pas de lien ici"))
        XCTAssertEqual(coordinator.phase, .failed(.noURL))
    }

    func testFinishAndDismissReturnToIdle() async {
        await coordinator.process(.text("Bonjour"))
        guard case .ready = coordinator.phase else { return XCTFail("Expected ready") }
        XCTAssertFalse(coordinator.isPresenting)
        coordinator.finish()
        XCTAssertEqual(coordinator.phase, .idle)

        await coordinator.process(.link("nothing"))
        XCTAssertTrue(coordinator.isPresenting)
        coordinator.dismiss()
        XCTAssertEqual(coordinator.phase, .idle)
    }

    func testProcessesNewestPendingShareAndDropsOlder() async throws {
        let older = try enqueue(SharedPayload(createdAt: Date(timeIntervalSinceNow: -60), texts: [SharedText(text: "Ancien")]))
        let newer = try enqueue(SharedPayload(texts: [SharedText(text: "Nouveau texte en français")]))

        coordinator.processPendingShares()
        await waitUntil { if case .ready = self.coordinator.phase { return true } else { return false } }

        XCTAssertEqual(ai.inputs, [.text("Nouveau texte en français")])
        XCTAssertNil(try? inbox.load(id: older.id))
        XCTAssertNil(try? inbox.load(id: newer.id))
    }

    func testDemoServiceProducesLabelledDemoLesson() async throws {
        let demo = DemoAIService(library: Fixtures.demoLibrary, stepDelay: .zero)
        let coordinator = IngestCoordinator(store: store, media: media, inbox: inbox, makeAIService: { demo }, currentLevel: { .a1 })

        await coordinator.process(.text("Hier, je suis allé au marché."))

        guard case .ready(let id) = coordinator.phase else { return XCTFail("Expected ready") }
        let lesson = try XCTUnwrap(store.lesson(id: id))
        XCTAssertEqual(lesson.origin, .demo)
        XCTAssertEqual(lesson.analysis.title, "A Saturday at the market", "Demo matches text to the closest sample")
    }

    private func waitUntil(timeout: TimeInterval = 2, _ condition: @escaping () -> Bool) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertTrue(condition(), "Timed out")
    }
}
