import Observation
import SwiftUI

enum AppTab: String, CaseIterable, Hashable, Identifiable {
    case home, library, speak, review, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .library: "Library"
        case .speak: "Speak"
        case .review: "Review"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .library: "books.vertical"
        case .speak: "bubble.left.and.bubble.right"
        case .review: "rectangle.on.rectangle"
        case .settings: "gearshape"
        }
    }
}

/// A lesson destination on a navigation stack.
struct LessonRoute: Hashable {
    let id: UUID
    /// Pushed from a visible thumbnail, so the lesson can zoom out of it.
    var zoomsFromThumbnail = false
}

/// Navigation state for the whole app.
@Observable
final class AppRouter {
    var selectedTab: AppTab = .home
    var homePath: [LessonRoute] = []
    var libraryPath: [LessonRoute] = []
    var speakPath: [PracticeScenario] = []
    var isShowingCaptureSheet = false
    var isShowingHowItWorks = false
    var isShowingListen = false

    /// Work to run once the capture sheet has fully dismissed, so a new
    /// presentation (processing cover, another sheet) never collides with it.
    @ObservationIgnored private var afterCaptureSheet: (() -> Void)?

    func dismissCaptureSheet(then action: @escaping () -> Void) {
        afterCaptureSheet = action
        isShowingCaptureSheet = false
    }

    func captureSheetDidDismiss() {
        let action = afterCaptureSheet
        afterCaptureSheet = nil
        action?()
    }

    func openLesson(_ id: UUID) {
        isShowingCaptureSheet = false
        selectedTab = .home
        homePath = [LessonRoute(id: id)]
    }

    /// Opens a speaking practice conversation about a lesson.
    func practice(_ lesson: Lesson) {
        selectedTab = .speak
        speakPath = [PracticeScenario.about(lesson)]
    }
}
