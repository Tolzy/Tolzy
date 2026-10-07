import SwiftUI
#if canImport(Translation)
import Translation
#endif

/// Shows whether Apple's French → English translation is on the iPhone,
/// and downloads it on request (the system shows its own confirmation).
@available(iOS 26.0, *)
struct TranslationDownloadRow: View {
    @State private var readiness: AppleTranslationService.Readiness?
    @State private var configuration: TranslationSession.Configuration?

    var body: some View {
        HStack {
            Label("French translation", systemImage: "character.bubble")
            Spacer()
            switch readiness {
            case .installed:
                Label("Downloaded", systemImage: "checkmark.circle.fill")
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(FLColor.success)
                    .font(.subheadline)
            case .needsDownload:
                Button("Download") {
                    configuration = TranslationSession.Configuration(
                        source: AppleTranslationService.source,
                        target: AppleTranslationService.target
                    )
                }
                .accessibilityIdentifier("downloadTranslation")
            case .unsupported:
                Text("Unavailable")
                    .foregroundStyle(FLColor.textSecondary)
                    .font(.subheadline)
            case nil:
                ProgressView()
            }
        }
        .task { readiness = await AppleTranslationService.readiness() }
        .translationTask(configuration) { session in
            try? await session.prepareTranslation()
            readiness = await AppleTranslationService.readiness()
        }
    }
}
