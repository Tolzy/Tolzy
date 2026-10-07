import UniformTypeIdentifiers
import XCTest
@testable import FrenchLens

final class SupportedContentTests: XCTestCase {
    func testMapsCommonTypesToCapabilities() {
        XCTAssertEqual(SupportedContent.capability(forTypeIdentifier: UTType.mpeg4Movie.identifier), .video)
        XCTAssertEqual(SupportedContent.capability(forTypeIdentifier: UTType.quickTimeMovie.identifier), .video)
        XCTAssertEqual(SupportedContent.capability(forTypeIdentifier: UTType.mpeg4Audio.identifier), .audio)
        XCTAssertEqual(SupportedContent.capability(forTypeIdentifier: UTType.url.identifier), .url)
        XCTAssertEqual(SupportedContent.capability(forTypeIdentifier: UTType.plainText.identifier), .text)
        XCTAssertEqual(SupportedContent.capability(forTypeIdentifier: UTType.jpeg.identifier), .image)
    }

    func testFileURLIsInspectedLaterNotGuessed() {
        XCTAssertNil(SupportedContent.capability(forTypeIdentifier: UTType.fileURL.identifier))
        XCTAssertTrue(SupportedContent.isSupported(typeIdentifiers: [UTType.fileURL.identifier]))
    }

    func testUnknownAndPrivateTypesAreUnsupported() {
        XCTAssertNil(SupportedContent.capability(forTypeIdentifier: "com.instagram.private-thing"))
        XCTAssertFalse(SupportedContent.isSupported(typeIdentifiers: ["com.instagram.private-thing"]))
    }

    func testBestCapabilityFollowsProductPriority() {
        let instagramLike = [UTType.plainText.identifier, UTType.url.identifier]
        XCTAssertEqual(SupportedContent.bestCapability(forTypeIdentifiers: instagramLike), .url)

        let withVideo = instagramLike + [UTType.mpeg4Movie.identifier, UTType.jpeg.identifier]
        XCTAssertEqual(SupportedContent.bestCapability(forTypeIdentifiers: withVideo), .video)
    }

    func testCapabilityForLocalFiles() {
        XCTAssertEqual(SupportedContent.capability(forFileURL: URL(fileURLWithPath: "/tmp/reel.mp4")), .video)
        XCTAssertEqual(SupportedContent.capability(forFileURL: URL(fileURLWithPath: "/tmp/voice.m4a")), .audio)
        XCTAssertEqual(SupportedContent.capability(forFileURL: URL(fileURLWithPath: "/tmp/still.png")), .image)
    }
}
