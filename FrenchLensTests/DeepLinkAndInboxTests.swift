import XCTest
@testable import FrenchLens

final class DeepLinkAndInboxTests: XCTestCase {
    func testDeepLinkRoundTrip() {
        let id = UUID()
        XCTAssertEqual(DeepLink(url: DeepLink.ingest(id).url), .ingest(id))
        XCTAssertEqual(DeepLink(url: DeepLink.lesson(id).url), .lesson(id))
        XCTAssertEqual(DeepLink(url: URL(string: "frenchlens://home")!), .home)
        XCTAssertNil(DeepLink(url: URL(string: "https://frenchlens.app/ingest?id=\(id)")!))
        XCTAssertNil(DeepLink(url: URL(string: "frenchlens://ingest?id=nope")!))
    }

    func testInboxSavesLoadsListsAndRemoves() throws {
        let inbox = ShareInbox(rootURL: TestFiles.temporaryDirectory())
        let first = SharedPayload(createdAt: Date(timeIntervalSinceNow: -10), texts: [SharedText(text: "un")])
        let second = SharedPayload(urls: [SharedURL(url: URL(string: "https://www.instagram.com/reel/x/")!)])
        try inbox.save(second)
        try inbox.save(first)

        XCTAssertEqual(try inbox.load(id: second.id).urls, second.urls)
        XCTAssertEqual(inbox.pendingPayloads().map(\.id), [first.id, second.id], "Oldest first")

        inbox.remove(id: first.id)
        XCTAssertEqual(inbox.pendingPayloads().map(\.id), [second.id])
    }

    func testNotificationUserInfoCarriesDeepLink() {
        let id = UUID()
        let userInfo: [AnyHashable: Any] = [ShareNotifications.deepLinkKey: DeepLink.ingest(id).url.absoluteString]
        XCTAssertEqual(ShareNotifications.deepLink(from: userInfo), .ingest(id))
    }
}
