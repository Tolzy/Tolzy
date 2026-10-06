import SwiftUI

/// "Understanding your French…" with the pipeline's real stages.
struct LoadingView: View {
    let stage: ProcessingStage
    var onCancel: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathe = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                BrandMark()
                Spacer()
                if let onCancel {
                    Button("Cancel", action: onCancel)
                        .font(.body.weight(.medium))
                        .foregroundStyle(FLColor.textSecondary)
                }
            }

            Spacer()

            Text("Understanding\nyour French…")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .opacity(breathe ? 1 : 0.72)
                .accessibilityIdentifier("loading.title")

            ProgressLine(progress: stage.progress)
                .padding(.vertical, FLSpacing.l)

            VStack(alignment: .leading, spacing: FLSpacing.s) {
                ForEach(ProcessingStage.allCases.filter { $0 != .receiving }, id: \.self) { item in
                    HStack(spacing: FLSpacing.s) {
                        Image(systemName: item < stage ? "checkmark" : (item == stage ? "circle.fill" : "circle"))
                            .font(.system(size: item == stage ? 7 : 11, weight: .bold))
                            .frame(width: 16)
                            .foregroundStyle(item == stage ? FLColor.accent : FLColor.textTertiary)
                        Text(item.title)
                            .font(.subheadline)
                            .foregroundStyle(item <= stage ? FLColor.textPrimary : FLColor.textTertiary)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityValue(item < stage ? "Done" : (item == stage ? "In progress" : "Waiting"))
                }
            }
            .animation(FLMotion.gentle, value: stage)

            Spacer()
            Spacer()
        }
        .padding(.horizontal, FLSpacing.gutter)
        .padding(.vertical, FLSpacing.m)
        .onAppear {
            guard !reduceMotion else { breathe = true; return }
            withAnimation(FLMotion.slow.repeatForever(autoreverses: true)) { breathe = true }
        }
    }
}

/// Quiet, editorial empty state.
struct EmptyState: View {
    let symbol: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .regular))
                .foregroundStyle(FLColor.textTertiary)
                .padding(.bottom, FLSpacing.xs)
                .accessibilityHidden(true)
            Text(title)
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
            Text(message)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if let actionTitle, let action {
                Button(action: action) {
                    HStack(spacing: 4) {
                        Text(actionTitle)
                        Image(systemName: "arrow.right")
                    }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(FLColor.accent)
                }
                .buttonStyle(.plain)
                .padding(.top, FLSpacing.xs)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, FLSpacing.xl)
        .accessibilityElement(children: .contain)
    }
}

/// Honest error with the next sensible step.
struct ErrorStateView: View {
    let error: IngestError
    var isDemoMode = false
    let onVideoPicked: (URL) -> Void
    let onPickerFailed: (IngestError) -> Void
    let onUseCaption: (String) -> Void
    let onRetry: () -> Void
    let onTryDemo: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                BrandMark()
                Spacer()
                IconButton(systemImage: "xmark", accessibilityLabel: "Close", action: onClose)
            }

            Spacer()

            Image(systemName: error.symbol)
                .font(.system(size: 28, weight: .regular))
                .foregroundStyle(FLColor.textTertiary)
                .padding(.bottom, FLSpacing.l)
                .accessibilityHidden(true)

            Text(error.title)
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("error.title")

            Text(error.message)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .padding(.top, FLSpacing.s)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()

            VStack(spacing: FLSpacing.s) {
                if error.offersVideoUpload {
                    AddVideoButton(onPicked: onVideoPicked, onFailure: onPickerFailed) {
                        ButtonLabel(title: "Add video", systemImage: "film")
                    }
                    .buttonStyle(FLButtonStyle(kind: .primary))
                }
                if error.canRetry {
                    SecondaryButton("Try again", systemImage: "arrow.clockwise", action: onRetry)
                }
                if let caption = error.caption {
                    SecondaryButton("Learn from the caption instead") { onUseCaption(caption) }
                }
                if isDemoMode {
                    Button("See a demo lesson", action: onTryDemo)
                        .font(.body.weight(.medium))
                        .foregroundStyle(FLColor.textSecondary)
                        .frame(minHeight: 44)
                }
            }
        }
        .padding(.horizontal, FLSpacing.gutter)
        .padding(.vertical, FLSpacing.m)
    }
}
