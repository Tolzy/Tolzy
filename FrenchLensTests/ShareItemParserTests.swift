import UniformTypeIdentifiers
import XCTest
@testable import FrenchLens

final class ShareItemParserTests: XCTestCase {
    private var directory: URL!

    override func setUp() {
        super.setUp()
        directory = TestFiles.temporaryDirectory()
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        super.tearDown()
    }

    private func parse(_ providers: [ItemProviding], texts: [String] = []) async -> SharedPayload {
        await ShareItemParser(payloadID: UUID(), directory: directory).parse(providers: providers, contentTexts: texts)
    }

    /// The common Instagram case: only a link (plus caption text).
    func testInstagramLinkOnly() async {
        let link = URL(string: "https://www.instagram.com/reel/C8xYz/?igsh=abc")!
        let provider = FakeItemProvider(types: [.url], values: [.url: link])
        let caption = FakeItemProvider(types: [.plainText], values: [.plainText: "Mon petit-déj 🥐 \(link.absoluteString)"])

        let payload = await parse([provider, caption])

        XCTAssertEqual(payload.urls.map(\.url.absoluteString), ["https://www.instagram.com/reel/C8xYz/"])
        XCTAssertTrue(payload.videos.isEmpty)
        XCTAssertEqual(payload.capabilities, [.url, .text])
        XCTAssertEqual(ContentResolver().resolve(payload), .link(payload.urls[0].url, caption: "Mon petit-déj 🥐"))
    }

    /// When a host shares both a video and its link, both are preserved.
    func testVideoAndURLArePreserved() async throws {
        let link = URL(string: "https://www.tiktok.com/@leo/video/123")!
        let video = FakeItemProvider(types: [.mpeg4Movie], files: [.mpeg4Movie: Data("video".utf8)], suggestedName: "reel.mp4")
        let url = FakeItemProvider(types: [.url], values: [.url: link])

        let payload = await parse([video, url])

        XCTAssertEqual(payload.videos.count, 1)
        XCTAssertEqual(payload.videos.first?.typeIdentifier, UTType.mpeg4Movie.identifier)
        XCTAssertEqual(payload.videos.first?.suggestedName, "reel.mp4")
        XCTAssertEqual(payload.urls.first?.url, link)
        let copied = directory.appendingPathComponent(try XCTUnwrap(payload.videos.first?.fileName))
        XCTAssertTrue(FileManager.default.fileExists(atPath: copied.path))

        guard case .video(_, let resolvedLink) = ContentResolver().resolve(payload) else {
            return XCTFail("Video must win over URL")
        }
        XCTAssertEqual(resolvedLink, link)
    }

    func testAudioImageAndText() async {
        let audio = FakeItemProvider(types: [.mpeg4Audio], files: [.mpeg4Audio: Data("a".utf8)])
        let image = FakeItemProvider(types: [.jpeg], files: [.jpeg: Data("i".utf8)])
        let text = FakeItemProvider(types: [.plainText], values: [.plainText: "J'en ai marre de travailler."])

        let payload = await parse([image, text, audio])

        XCTAssertEqual(payload.audio.count, 1)
        XCTAssertEqual(payload.images.count, 1)
        XCTAssertEqual(payload.texts.map(\.text), ["J'en ai marre de travailler."])
        XCTAssertEqual(payload.capabilities, [.audio, .image, .text])
        if case .audio = ContentResolver().resolve(payload) {} else { XCTFail("Audio outranks text and image") }
    }

    func testFileURLPointingAtAVideoIsCopied() async throws {
        let source = directory.appendingPathComponent("source.mov")
        try Data("movie".utf8).write(to: source)
        let provider = FakeItemProvider(types: [.fileURL], values: [.fileURL: source])

        let payload = await parse([provider])

        XCTAssertEqual(payload.videos.count, 1)
        XCTAssertTrue(payload.urls.isEmpty, "File URLs are never treated as web links")
    }

    func testAttributedContentTextContributesLinkAndCaption() async {
        let payload = await parse([], texts: ["Trop bien https://youtu.be/xyz?si=123"])
        XCTAssertEqual(payload.urls.map(\.url.absoluteString), ["https://youtu.be/xyz"])
        XCTAssertEqual(payload.texts.count, 1)
    }

    func testTextThatIsOnlyALinkDoesNotDuplicateAsText() async {
        let provider = FakeItemProvider(types: [.plainText], values: [.plainText: "https://www.instagram.com/reel/abc/"])
        let payload = await parse([provider])
        XCTAssertEqual(payload.urls.count, 1)
        XCTAssertTrue(payload.texts.isEmpty)
    }

    func testUnsupportedProviderYieldsEmptyPayload() async {
        let provider = FakeItemProvider(types: [UTType(exportedAs: "com.example.private")])
        let payload = await parse([provider])
        XCTAssertTrue(payload.isEmpty)
        XCTAssertEqual(ContentResolver().resolve(payload), .nothing)
        XCTAssertEqual(payload.summary, "Nothing readable")
    }

    func testRegisteredTypesAreRecordedOnce() async {
        let a = FakeItemProvider(types: [.url, .plainText], values: [.url: URL(string: "https://example.com")!])
        let b = FakeItemProvider(types: [.url], values: [.url: URL(string: "https://example.com")!])
        let payload = await parse([a, b])
        XCTAssertEqual(payload.registeredTypeIdentifiers, [UTType.url.identifier, UTType.plainText.identifier])
        XCTAssertEqual(payload.urls.count, 1)
    }
}
