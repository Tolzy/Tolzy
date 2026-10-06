import XCTest

/// End-to-end flows in Demo Mode, with isolated storage (`-ui-testing`).
final class FrenchLensUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launch()
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func openFirstLesson() {
        let row = element("lessonRow")
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()
        XCTAssertTrue(app.staticTexts["What they said"].waitForExistence(timeout: 5))
    }

    private func openDemo(_ id: String) {
        element("understandButton").tap()
        let demo = element("demoLesson.\(id)")
        XCTAssertTrue(demo.waitForExistence(timeout: 5))
        if !demo.isHittable { app.swipeUp() }
        demo.tap()
        XCTAssertTrue(app.staticTexts["What they said"].waitForExistence(timeout: 5))
    }

    func testLaunchShowsHome() {
        XCTAssertTrue(app.staticTexts["Bonjour."].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["What did you find today?"].exists)
        XCTAssertTrue(element("understandButton").exists)
        for tab in ["Home", "Library", "Review", "Settings"] {
            XCTAssertTrue(app.tabBars.buttons[tab].exists, tab)
        }
    }

    func testOpenDemoLesson() {
        openFirstLesson()
        XCTAssertTrue(element("videoHero").exists)
        XCTAssertTrue(app.staticTexts["Meaning"].exists)
    }

    func testTapTranscriptWordShowsPopover() {
        openDemo("demo-futur-proche")
        let word = element("token.prépare")
        XCTAssertTrue(word.waitForExistence(timeout: 5))
        word.tap()

        let popover = element("wordPopover")
        XCTAssertTrue(popover.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["PRÉPARER"].exists)
        XCTAssertTrue(app.staticTexts["to prepare"].exists)
        XCTAssertTrue(app.staticTexts["je prépare"].exists)

        app.buttons["Close"].firstMatch.tap()
        XCTAssertTrue(popover.waitForNonExistence(timeout: 3))
    }

    func testVerbAnalysis() {
        openDemo("demo-passe-compose")
        app.swipeUp()
        element("segment.Verbs").tap()
        XCTAssertTrue(app.staticTexts["SUIS ALLÉ"].waitForExistence(timeout: 3))
        XCTAssertTrue(element("verbCard.aller").exists)
        XCTAssertTrue(app.staticTexts["aller"].exists)
    }

    func testSaveLessonThenOpenLibrary() {
        openFirstLesson()
        let save = element("saveLessonButton")
        XCTAssertTrue(save.waitForExistence(timeout: 3))
        save.tap()
        XCTAssertEqual(save.label, "Saved to Library")

        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.tabBars.buttons["Library"].tap()
        XCTAssertTrue(element("savedLessonRow").waitForExistence(timeout: 3))

        app.segmentedControls.buttons["Vocabulary"].tap()
        XCTAssertTrue(element("vocabulary.franchement").waitForExistence(timeout: 3))
    }

    func testLibraryEmptyState() {
        app.tabBars.buttons["Library"].tap()
        XCTAssertTrue(element("library.emptyState").waitForExistence(timeout: 3))
    }

    func testOpenReview() {
        app.tabBars.buttons["Review"].tap()
        XCTAssertTrue(element("review.title").waitForExistence(timeout: 3))
        XCTAssertTrue(element("review.emptyState").exists)

        // Save a lesson, then review it.
        app.tabBars.buttons["Home"].tap()
        openFirstLesson()
        element("saveLessonButton").tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.tabBars.buttons["Review"].tap()

        element("review.start").tap()
        let option = element("review.option")
        XCTAssertTrue(option.waitForExistence(timeout: 3))
        option.tap()
        XCTAssertTrue(element("review.continue").waitForExistence(timeout: 3))
    }

    func testMotionLabOpensFromSettings() {
        app.tabBars.buttons["Settings"].tap()
        let link = element("motionLabLink")
        XCTAssertTrue(link.waitForExistence(timeout: 3))
        link.tap()
        XCTAssertTrue(element("motionLab").waitForExistence(timeout: 3))
    }
}
