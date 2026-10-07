import Foundation

/// Chooses the AI implementation at the moment a lesson is requested, so
/// changing the analysis mode in Settings takes effect immediately.
struct AIServiceFactory {
    let settings: AppSettings
    let configuration: APIConfiguration
    let media: MediaProcessing
    let demoLibrary: DemoLibrary
    var demoStepDelay: Duration = .milliseconds(650)

    /// The mode actually used: falls back when the chosen one can't run here.
    var resolvedMode: AnalysisMode {
        switch settings.analysisMode {
        case .backend where !configuration.isConfigured:
            return OnDeviceCapability.isSupportedOS ? .onDevice : .demo
        case .onDevice where !OnDeviceCapability.isSupportedOS:
            return .demo
        default:
            return settings.analysisMode
        }
    }

    var isDemoMode: Bool { resolvedMode == .demo }

    func make() -> AIService {
        switch resolvedMode {
        case .demo:
            return DemoAIService(library: demoLibrary, stepDelay: demoStepDelay)
        case .backend:
            let client = APIClient(configuration: configuration)
            return PipelineAIService(
                media: media,
                transcription: RemoteTranscriptionService(client: client),
                analysis: RemoteLanguageAnalysisService(client: client),
                translation: RemoteTranslationService(client: client),
                origin: .backend
            )
        case .onDevice:
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                return PipelineAIService(
                    media: media,
                    transcription: OnDeviceTranscriptionService(),
                    analysis: OnDeviceLanguageAnalysisService(),
                    translation: nil,
                    origin: .onDevice
                )
            }
            #endif
            return DemoAIService(library: demoLibrary, stepDelay: demoStepDelay)
        }
    }
}
