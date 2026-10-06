import Foundation
import Observation
import UIKit

/// The dependency container. Built once at launch and injected into the
/// SwiftUI environment; views and view models never construct services.
@MainActor
@Observable
final class AppEnvironment {
    let settings: AppSettings
    let store: LessonStore
    let router: AppRouter
    let demoLibrary: DemoLibrary
    let media: MediaService
    let tts: SpeechSynthesizerTTSService
    let apiConfiguration: APIConfiguration
    let aiFactory: AIServiceFactory
    let inbox: ShareInbox?
    let ingest: IngestCoordinator
    let isUITesting: Bool

    init(
        settings: AppSettings,
        store: LessonStore,
        demoLibrary: DemoLibrary,
        media: MediaService,
        apiConfiguration: APIConfiguration,
        inbox: ShareInbox?,
        demoStepDelay: Duration,
        isUITesting: Bool
    ) {
        self.settings = settings
        self.store = store
        self.router = AppRouter()
        self.demoLibrary = demoLibrary
        self.media = media
        self.tts = SpeechSynthesizerTTSService()
        self.apiConfiguration = apiConfiguration
        self.inbox = inbox
        self.isUITesting = isUITesting

        let factory = AIServiceFactory(
            settings: settings,
            configuration: apiConfiguration,
            media: media,
            demoLibrary: demoLibrary,
            demoStepDelay: demoStepDelay
        )
        self.aiFactory = factory
        self.ingest = IngestCoordinator(
            store: store,
            media: media,
            inbox: inbox,
            makeAIService: { factory.make() },
            currentLevel: { settings.level }
        )
    }

    /// Production wiring, or an isolated sandbox when launched by UI tests.
    static func makeDefault(processInfo: ProcessInfo = .processInfo) -> AppEnvironment {
        let isUITesting = processInfo.arguments.contains(LaunchArgument.uiTesting)
        let supportDirectory: URL
        let defaults: UserDefaults

        if isUITesting {
            supportDirectory = FileManager.default.temporaryDirectory
                .appendingPathComponent("FrenchLens-UITests-\(UUID().uuidString)", isDirectory: true)
            defaults = UserDefaults(suiteName: "FrenchLens.UITests") ?? .standard
            defaults.removePersistentDomain(forName: "FrenchLens.UITests")
            UIView.setAnimationsEnabled(false)
            MotionRuntime.isDisabled = true
        } else {
            supportDirectory = LessonStore.defaultDirectory
            defaults = .standard
        }

        let demoLibrary = DemoLibrary.load()
        let store = LessonStore(directory: supportDirectory)
        if !processInfo.arguments.contains(LaunchArgument.emptyLibrary) {
            store.seedDemoLessonsIfNeeded(from: demoLibrary)
        }

        return AppEnvironment(
            settings: AppSettings(defaults: defaults),
            store: store,
            demoLibrary: demoLibrary,
            media: MediaService(directory: supportDirectory.appendingPathComponent("Media", isDirectory: true)),
            apiConfiguration: APIConfiguration.current(),
            inbox: isUITesting ? nil : ShareInbox.appGroup(),
            demoStepDelay: isUITesting ? .milliseconds(50) : .milliseconds(650),
            isUITesting: isUITesting
        )
    }

    // MARK: Actions

    func handle(url: URL) {
        guard let link = DeepLink(url: url) else { return }
        switch link {
        case .ingest:
            ingest.handle(link)
        case .lesson(let id):
            if store.lesson(id: id) != nil { router.openLesson(id) }
        case .home:
            router.selectedTab = .home
        }
    }

    /// Opens a demo lesson, reusing an existing copy if there is one.
    func openDemo(_ demo: DemoLesson?) {
        guard let demo else { return }
        let existing = store.recent.first { $0.origin == .demo && $0.source.kind != .upload && $0.analysis.title == demo.analysis.title }
        if let existing {
            router.openLesson(existing.id)
        } else {
            let lesson = demo.makeLesson(level: settings.level)
            store.add(lesson)
            router.openLesson(lesson.id)
        }
    }

    func mediaURL(for lesson: Lesson) -> URL? {
        lesson.source.mediaFileName.map(media.mediaURL(named:))
    }

    func thumbnailURL(for lesson: Lesson) -> URL? {
        lesson.source.thumbnailFileName.map(media.mediaURL(named:))
    }

    /// Deletes all lessons and media.
    func resetLibrary() {
        tts.stop()
        store.removeAll()
        media.removeAll()
        inbox?.removeAll()
        router.homePath = []
        router.libraryPath = []
    }
}

enum LaunchArgument {
    /// Isolated storage, fast demo pipeline, no animations.
    static let uiTesting = "-ui-testing"
    /// Skip seeding demo lessons (to see empty states).
    static let emptyLibrary = "-empty-library"
}
