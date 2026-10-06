import SwiftUI

/// Minimal by design: brand, one sentence, a hairline of progress, then a
/// clear statement of what happens next.
struct ShareExtensionView: View {
    let model: ShareExtensionModel
    let onDone: () -> Void
    let onCancel: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                BrandMark()
                Spacer()
                if case .ready = model.phase {
                    Button("Done", action: onDone)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(FLColor.accent)
                } else {
                    Button("Cancel", action: onCancel)
                        .font(.body)
                        .foregroundStyle(FLColor.textSecondary)
                }
            }

            Spacer(minLength: FLSpacing.xxl)

            Group {
                switch model.phase {
                case .detecting:
                    detecting
                case .ready(let summary, let resolved, let link):
                    ready(summary: summary, resolved: resolved, link: link)
                case .failed(let message):
                    failed(message)
                }
            }
            .transition(.opacity)

            Spacer(minLength: FLSpacing.xxl)
        }
        .padding(FLSpacing.gutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(FLColor.background.ignoresSafeArea())
        .animation(reduceMotion ? .easeInOut(duration: 0.2) : FLMotion.spring, value: model.phase)
        .sensoryFeedback(trigger: model.phase) { _, phase -> SensoryFeedback? in
            switch phase {
            case .ready: return .success
            case .failed: return .error
            case .detecting: return nil
            }
        }
        .preferredColorScheme(.dark)
    }

    private var detecting: some View {
        VStack(alignment: .leading, spacing: FLSpacing.l) {
            Text("Understanding\nyour French…")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
            ProgressLine(progress: nil)
        }
    }

    private func ready(summary: String, resolved: SharedCapability?, link: URL?) -> some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            Image(systemName: "checkmark")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(FLColor.accent)
            Text("\(summary) received.")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
            Text(nextStep(resolved: resolved, link: link))
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    private func failed(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(FLColor.textTertiary)
            Text("Nothing to learn from yet.")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
            Text(message)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    /// Honest about what the app will be able to do with what arrived.
    private func nextStep(resolved: SharedCapability?, link: URL?) -> String {
        switch resolved {
        case .video, .audio:
            return "Open FrenchLens to see your lesson."
        case .url:
            let noun = link.map { SourcePlatform(url: $0).mediaNoun(for: $0) } ?? "video"
            return "Open FrenchLens to continue. This app shared the \(noun) link but not the video itself, so FrenchLens may ask you to add the video from Photos."
        case .text:
            return "Open FrenchLens to turn this text into a lesson."
        case .image:
            return "FrenchLens learns from speech. Open the app to add the video instead."
        case nil:
            return "Open FrenchLens to continue."
        }
    }
}
