import SwiftUI

/// Full-screen state shown while a share becomes a lesson, or when it can't.
struct ProcessingView: View {
    @Environment(IngestCoordinator.self) private var ingest
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        ZStack {
            FLColor.background.ignoresSafeArea()
            switch ingest.phase {
            case .failed(let error):
                ErrorStateView(
                    error: error,
                    isDemoMode: environment.aiFactory.isDemoMode,
                    onVideoPicked: { ingest.submit(.video($0)) },
                    onPickerFailed: { ingest.present($0) },
                    onUseCaption: { ingest.submit(.text($0)) },
                    onRetry: { ingest.retry() },
                    onTryDemo: {
                        ingest.dismiss()
                        environment.openDemo(environment.demoLibrary.lessons.first)
                    },
                    onClose: { ingest.dismiss() }
                )
                .transition(.opacity)
            case .processing(let stage):
                LoadingView(stage: stage, onCancel: { ingest.dismiss() })
                    .transition(.opacity)
            case .idle, .ready:
                LoadingView(stage: .buildingLesson, onCancel: nil)
            }
        }
        .animation(FLMotion.gentle, value: ingest.phase)
    }
}
