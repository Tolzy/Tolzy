import XCTest
@testable import FrenchLens

final class URLExtractorTests: XCTestCase {
    func testFindsInstagramReelInCaption() {
        let text = "Regarde ça 😂 https://www.instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA== trop drôle"
        let urls = URLExtractor.urls(in: text)
        XCTAssertEqual(urls.count, 1)
        XCTAssertEqual(urls.first?.absoluteString, "https://www.instagram.com/reel/C8xYz12AbCd/")
    }

    func testStripsTrackingButKeepsMeaningfulQuery() {
        let url = URL(string: "https://www.youtube.com/watch?v=abc123&si=tracking&utm_source=share")!
        XCTAssertEqual(URLExtractor.normalize(url).absoluteString, "https://www.youtube.com/watch?v=abc123")
    }

    func testDeduplicatesAndPreservesOrder() {
        let text = "https://tiktok.com/@a/video/1 and https://example.com/x and https://tiktok.com/@a/video/1"
        XCTAssertEqual(URLExtractor.urls(in: text).map(\.absoluteString), [
            "https://tiktok.com/@a/video/1",
            "https://example.com/x",
        ])
    }

    func testIgnoresNonWebSchemes() {
        XCTAssertTrue(URLExtractor.urls(in: "mailto:hello@example.com ftp://files.example.com").isEmpty)
        XCTAssertNil(URLExtractor.firstURL(in: "Je vais vous montrer mon petit-déjeuner."))
    }

    func testInterpretsLoadedItemsOfEveryShape() {
        let expected = URL(string: "https://www.instagram.com/reel/abc/")!
        XCTAssertEqual(URLExtractor.url(fromLoadedItem: expected), expected)
        XCTAssertEqual(URLExtractor.url(fromLoadedItem: expected.absoluteString), expected)
        XCTAssertEqual(URLExtractor.url(fromLoadedItem: Data(expected.absoluteString.utf8)), expected)
        XCTAssertEqual(URLExtractor.url(fromLoadedItem: NSAttributedString(string: "see \(expected.absoluteString)")), expected)
        XCTAssertNil(URLExtractor.url(fromLoadedItem: 42))
    }

    func testDetectsPlatforms() {
        XCTAssertEqual(SourcePlatform(url: URL(string: "https://www.instagram.com/reel/x/")!), .instagram)
        XCTAssertEqual(SourcePlatform(url: URL(string: "https://vm.tiktok.com/ZM123/")!), .tiktok)
        XCTAssertEqual(SourcePlatform(url: URL(string: "https://youtu.be/abc")!), .youtube)
        XCTAssertEqual(SourcePlatform(url: URL(string: "https://notinstagram.com/reel/x")!), .web)
        XCTAssertEqual(SourcePlatform.instagram.mediaNoun(for: URL(string: "https://instagram.com/reel/x")!), "Reel")
        XCTAssertEqual(SourcePlatform.youtube.mediaNoun(for: URL(string: "https://youtube.com/shorts/x")!), "Short")
    }
}
