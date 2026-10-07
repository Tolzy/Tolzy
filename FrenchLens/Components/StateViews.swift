import SwiftUI

/// "Understanding your French…" with the pipeline's real stages.
///
/// Choreography: the lens pulses while work happens; each finished stage's
/// dot is replaced by a check (symbol transition) and the next stage lights
/// up; on completion the title swaps, the line fills and a checkmark draws
/// itself before the lesson takes over.
struct LoadingView: View {
    let stage: ProcessingStage
    var isComplete = false
    var onCancel: (() -> Void)?

    @Environment(\.motion) private var motion

    private var visibleStages: [ProcessingStage] {
        ProcessingStage.allCases.filter { $0 != .receiving }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                BrandMark()
                Spacer()
                if let onCancel, !isComplete {
                    Button("Cancel", action: onCancel)
                        .font(.body.weight(.medium))
                        .foregroundStyle(FLColor.textSecondary)
                        .transition(.opacity)
                }
            }

            Spacer()

            ZStack(alignment: .leading) {
                if isComplete {
                    DrawnCheckmark(size: 52)
                        .transition(.flReveal)
                } else {
                    LensPulse(size: 52)
                        .transition(.flSwap)
                }
            }
            .frame(height: 52)
            .padding(.bottom, FLSpacing.l)

            ZStack(alignment: .topLeading) {
                if isComplete {
                    Text("Your lesson\nis ready.")
                        .transition(.flSwap)
                } else {
                    Text("Understanding\nyour French…")
                        .flShimmer()
                        .transition(.flSwap)
                }
            }
            .flTextStyle(.display)
            .foregroundStyle(FLColor.textPrimary)
            .accessibilityIdentifier("loading.title")
            .accessibilityAddTraits(.updatesFrequently)

            ProgressLine(progress: isComplete ? 1 : stage.progress)
                .padding(.vertical, FLSpacing.l)

            VStack(alignment: .leading, spacing: FLSpacing.s) {
                ForEach(Array(visibleStages.enumerated()), id: \.element) { index, item in
                    StageRow(title: item.title, state: state(of: item))
                        .flAppear(index + 2)
                }
            }

            Spacer()
            Spacer()
        }
        .padding(.horizontal, FLSpacing.gutter)
        .padding(.vertical, FLSpacing.m)
        .flAnimation(.swap, value: stage)
        .flAnimation(.reveal, value: isComplete)
        .flHaptic(.progress, trigger: stage)
        .flHaptic(.success, trigger: isComplete)
    }

    private func state(of item: ProcessingStage) -> StageRow.Status {
        if isComplete || item < stage { return .done }
        return item == stage ? .active : .pending
    }
}

private struct StageRow: View {
    enum Status { case pending, active, done }

    let title: String
    let state: Status

    var body: some View {
        HStack(spacing: FLSpacing.s) {
            Image(systemName: symbol)
                .font(.system(size: state == .active ? 7 : 11, weight: .bold))
                .frame(width: 16)
                .foregroundStyle(state == .active ? FLColor.accent : FLColor.textTertiary)
                .contentTransition(.symbolEffect(.replace))
            Text(title)
                .font(.subheadline)
                .foregroundStyle(state == .pending ? FLColor.textTertiary : FLColor.textPrimary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(state == .done ? "Done" : (state == .active ? "In progress" : "Waiting"))
    }

    private var symbol: String {
        switch state {
        case .pending: "circle"
        case .active: "circle.fill"
        case .done: "checkmark"
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
                .symbolEffect(.pulse, options: .nonRepeating)
                .padding(.bottom, FLSpacing.xs)
                .accessibilityHidden(true)
                .flAppear(0)
            Text(title)
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
                .flAppear(1)
            Text(message)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .flAppear(2)
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
                .flAppear(3)
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
    var onListen: (() -> Void)?
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
                .symbolEffect(.pulse, options: .nonRepeating)
                .padding(.bottom, FLSpacing.l)
                .accessibilityHidden(true)
                .flAppear(0)

            Text(error.title)
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("error.title")
                .flAppear(1)

            Text(error.isLinkOnly ? "Play it in Instagram while FrenchLens listens, or add the video from Photos." : error.message)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .padding(.top, FLSpacing.s)
                .fixedSize(horizontal: false, vertical: true)
                .flAppear(2)

            Spacer()

            VStack(spacing: FLSpacing.s) {
                if case .linkOnly = error, let onListen {
                    PrimaryButton("Listen while you watch", systemImage: "waveform", action: onListen)
                        .accessibilityIdentifier("listenInstead")
                    AddVideoButton(onPicked: onVideoPicked, onFailure: onPickerFailed) {
                        ButtonLabel(title: "Add video", systemImage: "film")
                    }
                    .buttonStyle(FLButtonStyle(kind: .secondary))
                } else if error.offersVideoUpload {
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
            .flAppear(4)
        }
        .padding(.horizontal, FLSpacing.gutter)
        .padding(.vertical, FLSpacing.m)
    }
}
