import Foundation

/// Chooses the AI implementation at the moment a lesson is requested, so
/// toggling Demo Mode in Settings takes effect immediately.
struct AIServiceFactory {
    let settings: AppSettings
    let configuration: APIConfiguration
    let media: MediaProcessing
    let demoLibrary: DemoLibrary
    var demoStepDelay: Duration = .milliseconds(650)

    var isDemoMode: Bool {
        settings.demoModeEnabled || !configuration.isConfigured
    }

    func make() -> AIService {
        if isDemoMode {
            return DemoAIService(library: demoLibrary, stepDelay: demoStepDelay)
        }
        let client = APIClient(configuration: configuration)
        return RemoteAIService(
            media: media,
            transcription: RemoteTranscriptionService(client: client),
            analysis: RemoteLanguageAnalysisService(client: client),
            translation: RemoteTranslationService(client: client)
        )
    }
}
