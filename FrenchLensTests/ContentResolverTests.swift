import XCTest
@testable import FrenchLens

final class ContentResolverTests: XCTestCase {
    private let resolver = ContentResolver()
    private let reel = URL(string: "https://www.instagram.com/reel/abc/")!

    func testPriorityVideoAudioURLTextImage() {
        let video = SharedVideo(fileName: "v.mp4", typeIdentifier: "public.mpeg-4")
        let audio = SharedAudio(fileName: "a.m4a", typeIdentifier: "com.apple.m4a-audio")
        let image = SharedImage(fileName: "i.jpg", typeIdentifier: "public.jpeg")
        let text = SharedText(text: "Bonjour tout le monde")

        var payload = SharedPayload(videos: [video], audio: [audio], urls: [SharedURL(url: reel)], texts: [text], images: [image])
        XCTAssertEqual(resolver.resolve(payload), .video(video, link: reel))

        payload.videos = []
        XCTAssertEqual(resolver.resolve(payload), .audio(audio, link: reel))

        payload.audio = []
        XCTAssertEqual(resolver.resolve(payload), .link(reel, caption: "Bonjour tout le monde"))

        payload.urls = []
        XCTAssertEqual(resolver.resolve(payload), .text("Bonjour tout le monde"))

        payload.texts = []
        XCTAssertEqual(resolver.resolve(payload), .image(image, link: nil))

        payload.images = []
        XCTAssertEqual(resolver.resolve(payload), .nothing)
    }

    func testLinkHiddenInTextStillCountsAsURL() {
        let payload = SharedPayload(texts: [SharedText(text: "lol \(reel.absoluteString)")])
        XCTAssertEqual(resolver.resolve(payload), .link(reel, caption: nil), "Short captions are not worth a lesson")
    }

    func testWhitespaceTextIsIgnored() {
        XCTAssertEqual(resolver.resolve(SharedPayload(texts: [SharedText(text: "  \n ")])), .nothing)
    }

    func testSummaryDescribesWhatArrived() {
        let payload = SharedPayload(
            videos: [SharedVideo(fileName: "v", typeIdentifier: "public.mpeg-4")],
            urls: [SharedURL(url: reel)]
        )
        XCTAssertEqual(payload.summary, "Video and Reel link")
    }
}
