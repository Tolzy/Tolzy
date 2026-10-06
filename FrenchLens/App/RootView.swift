import SwiftUI

struct RootView: View {
    @Environment(AppRouter.self) private var router
    @Environment(IngestCoordinator.self) private var ingest
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.motion) private var motion

    var body: some View {
        @Bindable var router = router

        BottomNavigation(selection: $router.selectedTab) { tab in
            switch tab {
            case .home: HomeView()
            case .library: LibraryView()
            case .review: ReviewView()
            case .settings: SettingsView()
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { ingest.isPresenting },
            set: { if !$0 { ingest.dismiss() } }
        )) {
            ProcessingView()
        }
        .sheet(isPresented: $router.isShowingHowItWorks) {
            HowItWorksView()
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
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { ingest.processPendingShares() }
        }
        .task { ingest.processPendingShares() }
    }
}
