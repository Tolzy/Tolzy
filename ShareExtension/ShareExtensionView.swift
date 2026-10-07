import SwiftUI

/// Minimal by design: brand, one sentence, a hairline of progress, then a
/// clear statement of what happens next.
///
/// Choreography: the lens pulses while the share is read; on success the
/// lens gives way to a checkmark that draws itself and the copy rises in;
/// on failure the message simply replaces the title. Reduce Motion turns all
/// of it into cross-fades.
struct ShareExtensionView: View {
    let model: ShareExtensionModel
    let onDone: () -> Void
    let onCancel: () -> Void

    @Environment(\.motion) private var motion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                BrandMark()
                Spacer()
                if case .ready = model.phase {
                    Button("Done", action: onDone)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(FLColor.accent)
                        .transition(.flSwap)
                } else {
                    Button("Cancel", action: onCancel)
                        .font(.body)
                        .foregroundStyle(FLColor.textSecondary)
                }
            }

            Spacer(minLength: FLSpacing.xxl)

            ZStack(alignment: .topLeading) {
                switch model.phase {
                case .detecting:
                    detecting.transition(.flSwap)
                case .ready(let summary, let resolved, let link):
                    ready(summary: summary, resolved: resolved, link: link).transition(.flReveal)
                case .failed(let message):
                    failed(message).transition(.flReveal)
                }
            }

            Spacer(minLength: FLSpacing.xxl)
        }
        .padding(FLSpacing.gutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(FLColor.background.ignoresSafeArea())
        .flAnimation(.reveal, value: model.phase)
        .flHaptic(trigger: model.phase) { _, phase -> FLHaptic? in
            switch phase {
            case .ready: return FLHaptic.success
            case .failed: return FLHaptic.failure
            case .detecting: return nil
            }
        }
        .preferredColorScheme(.dark)
    }

    private var detecting: some View {
        VStack(alignment: .leading, spacing: FLSpacing.l) {
            LensPulse(size: 48)
                .flAppear(0)
            Text("Understanding\nyour French…")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .flShimmer()
                .flAppear(1)
            ProgressLine(progress: nil)
                .flAppear(2)
        }
    }

    private func ready(summary: String, resolved: SharedCapability?, link: URL?) -> some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            DrawnCheckmark(size: 48)
            Text("\(summary) received.")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
                .flAppear(1)
            Text(nextStep(resolved: resolved, link: link))
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .flAppear(2)
        }
        .accessibilityElement(children: .combine)
    }

    private func failed(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(FLColor.textTertiary)
                .flAppear(0)
            Text("Nothing to learn from yet.")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
                .flAppear(1)
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
