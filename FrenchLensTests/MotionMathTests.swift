import XCTest
@testable import FrenchLens

final class MotionMathTests: XCTestCase {
    func testStaggerIsOrderedAndCapped() {
        XCTAssertEqual(Choreography.delay(for: 0), 0)
        XCTAssertEqual(Choreography.delay(for: -3), 0)
        XCTAssertLessThan(Choreography.delay(for: 1), Choreography.delay(for: 2))
        XCTAssertEqual(Choreography.delay(for: 1_000), Choreography.maxDelay, "Long lists never drag")
    }

    func testScrollProgressIsClampedAndLinear() {
        let progress = ScrollProgress(start: 100, end: 200)
        XCTAssertEqual(progress(-50), 0)
        XCTAssertEqual(progress(100), 0)
        XCTAssertEqual(progress(150), 0.5, accuracy: 0.0001)
        XCTAssertEqual(progress(200), 1)
        XCTAssertEqual(progress(900), 1)
    }

    func testDegenerateRangeActsAsThreshold() {
        let threshold = ScrollProgress(start: 80, end: 80)
        XCTAssertEqual(threshold(79), 0)
        XCTAssertEqual(threshold(80), 1)
    }
}
