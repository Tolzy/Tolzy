import SwiftUI

/// Full-screen state shown while a share becomes a lesson, or when it can't.
/// Transitions between working, ready and failed are choreographed here so
/// the cover never cuts: content swaps in place, then the lesson takes over.
struct ProcessingView: View {
    @Environment(IngestCoordinator.self) private var ingest
    @Environment(AppEnvironment.self) private var environment
    @Environment(AppRouter.self) private var router

    var body: some View {
        ZStack {
            FLColor.background.ignoresSafeArea()
            switch ingest.phase {
            case .failed(let error):
                ErrorStateView(
                    error: error,
                    isDemoMode: true,
                    onVideoPicked: { ingest.submit(.video($0)) },
                    onPickerFailed: { ingest.present($0) },
                    onUseCaption: { ingest.submit(.text($0)) },
                    onRetry: { ingest.retry() },
                    onTryDemo: {
                        ingest.dismiss()
                        environment.openDemo(environment.demoLibrary.lessons.first)
                    },
                    onListen: {
                        ingest.dismiss()
                        let router = self.router
                        Task { @MainActor in
                            // Let the cover finish leaving before the sheet arrives.
                            try? await Task.sleep(for: .milliseconds(500))
                            router.isShowingListen = true
                        }
                    },
                    onClose: { ingest.dismiss() }
                )
                .id(error.id)
                .transition(.flReveal)
            case .processing(let stage):
                LoadingView(stage: stage, onCancel: { ingest.dismiss() })
                    .transition(.flReveal)
            case .ready:
                LoadingView(stage: .buildingLesson, isComplete: true)
            case .idle:
                LoadingView(stage: .buildingLesson, isComplete: true)
            }
        }
        .flAnimation(.reveal, value: phaseKind)
        .flHaptic(trigger: ingest.phase) { _, new in
            if case .failed = new { return FLHaptic.failure }
            return nil
        }
    }

    /// Animate between kinds of state, not on every stage tick (LoadingView
    /// animates its own stages).
    private var phaseKind: Int {
        switch ingest.phase {
        case .idle: 0
        case .processing: 1
        case .ready: 2
        case .failed: 3
        }
    }
}
