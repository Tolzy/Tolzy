import SwiftUI

struct RootView: View {
    @Environment(AppRouter.self) private var router
    @Environment(IngestCoordinator.self) private var ingest
    @Environment(ListenSession.self) private var listen
    @Environment(MilestoneStore.self) private var milestones
    @Environment(LessonStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.motion) private var motion

    var body: some View {
        @Bindable var router = router

        BottomNavigation(selection: $router.selectedTab) { tab in
            switch tab {
            case .home: HomeView()
            case .library: LibraryView()
            case .speak: SpeakView()
            case .review: ReviewView()
            case .settings: SettingsView()
            }
        }
        .overlay { MomentPresenter() }
        .fullScreenCover(isPresented: Binding(
            get: { ingest.isPresenting },
            set: { if !$0 { ingest.dismiss() } }
        )) {
            ProcessingView()
        }
        .sheet(isPresented: $router.isShowingHowItWorks) {
            HowItWorksView()
        }
        .sheet(isPresented: $router.isShowingListen) {
            ListenView()
        }
        .sheet(isPresented: $router.isShowingMoments) {
            MomentsGalleryView()
        }
        .onChange(of: ingest.phase) { _, phase in
            guard case .ready(let id) = phase else { return }
            // Hold the "ready" moment (checkmark draws), push the lesson
            // underneath, then let the cover slide away to reveal it.
            Task { @MainActor in
                if motion.allowsMovement {
                    try? await Task.sleep(for: Choreography.completionHold)
                }
                router.openLesson(id)
                ingest.finish()
                if let lesson = store.lesson(id: id) {
                    milestones.record(.lessonCreated(title: lesson.analysis.title, fromReel: lesson.source.kind == .listened))
                }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                milestones.recordActiveDay()
                listen.refresh()
                // While a capture is running, its audio isn't ready yet.
                if !listen.isActive { ingest.processPendingShares() }
            }
        }
        .task {
            milestones.recordActiveDay()
            ingest.processPendingShares()
        }
    }
}
