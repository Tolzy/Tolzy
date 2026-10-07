import XCTest

/// Captures the main screens as test attachments. CI exports them as the
/// "screenshots" artifact so the app can be reviewed without a Mac.
final class ScreenshotTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launch()
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func snapshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testCaptureMainScreens() {
        XCTAssertTrue(app.staticTexts["Bonjour."].waitForExistence(timeout: 5))
        snapshot("01-home")

        element("understandButton").tap()
        _ = element("demoLesson.demo-futur-proche").waitForExistence(timeout: 5)
        snapshot("02-understand-something")
        app.swipeUp()
        let demo = element("demoLesson.demo-futur-proche")
        if demo.waitForExistence(timeout: 3) { demo.tap() }

        XCTAssertTrue(app.staticTexts["What they said"].waitForExistence(timeout: 5))
        snapshot("03-lesson")

        let word = element("token.prépare")
        if word.waitForExistence(timeout: 3) {
            word.tap()
            _ = element("wordPopover").waitForExistence(timeout: 3)
            snapshot("04-word-lookup")
            app.buttons["Close"].firstMatch.tap()
        }

        app.swipeUp()
        app.swipeUp()
        let verbs = element("segment.Verbs")
        if verbs.waitForExistence(timeout: 3) {
            verbs.tap()
            snapshot("05-verbs")
        }
        let grammar = element("segment.Grammar")
        if grammar.waitForExistence(timeout: 3) {
            grammar.tap()
            snapshot("06-grammar")
        }

        element("saveLessonButton").tap()
        snapshot("07-saved")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        app.tabBars.buttons["Library"].tap()
        _ = element("savedLessonRow").waitForExistence(timeout: 3)
        snapshot("08-library")

        app.tabBars.buttons["Review"].tap()
        let start = element("review.start")
        if start.waitForExistence(timeout: 3) {
            snapshot("09-review-intro")
            start.tap()
            let option = element("review.option")
            if option.waitForExistence(timeout: 3) {
                snapshot("10-review-question")
                option.tap()
                snapshot("11-review-answered")
            }
        }

        app.tabBars.buttons["Speak"].tap()
        let cafe = element("speak.scenario.cafe")
        if cafe.waitForExistence(timeout: 3) {
            snapshot("14-speak")
            cafe.tap()
            if element("chat.tutor").waitForExistence(timeout: 5) {
                let input = element("conversation.input")
                input.tap()
                input.typeText("Je suis faim")
                element("conversation.send").tap()
                _ = element("chat.correction").waitForExistence(timeout: 5)
                snapshot("15-speak-conversation")
            }
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }

        app.tabBars.buttons["Settings"].tap()
        snapshot("12-settings")

        app.tabBars.buttons["Home"].tap()
        let listen = element("homeListen")
        if listen.waitForExistence(timeout: 3) {
            listen.tap()
            _ = element("startListening").waitForExistence(timeout: 3)
            snapshot("13-listen-while-you-watch")
        }
    }
}
