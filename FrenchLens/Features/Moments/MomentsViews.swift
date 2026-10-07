import SwiftUI

/// Shows earned moments one at a time, at a calm pause: never during a
/// conversation, over the processing screen, or behind a sheet.
struct MomentPresenter: View {
    @Environment(MilestoneStore.self) private var milestones
    @Environment(IngestCoordinator.self) private var ingest
    @Environment(AppRouter.self) private var router
    @Environment(\.motion) private var motion

    @State private var showing: UnlockedMilestone?

    private var isCalm: Bool {
        !milestones.isHeld && !ingest.isPresenting
            && !router.isShowingCaptureSheet && !router.isShowingListen && !router.isShowingHowItWorks
            && !router.isShowingMoments
    }

    /// Changes whenever a moment might become showable.
    private var readiness: String {
        "\(milestones.next?.id ?? "-")|\(isCalm)|\(showing?.id ?? "-")"
    }

    var body: some View {
        ZStack {
            if let showing {
                MomentCelebrationView(moment: showing) { finish() }
                    .id(showing.id)
                    .transition(.opacity)
            }
        }
        .task(id: readiness) {
            guard showing == nil, milestones.next != nil, isCalm else { return }
            // Let whatever just happened land first (the lesson opening,
            // the chat closing).
            try? await Task.sleep(for: .milliseconds(motion.allowsMovement ? 900 : 300))
            guard !Task.isCancelled, showing == nil, isCalm, let next = milestones.next else { return }
            withAnimation(.easeOut(duration: 0.3)) { showing = next }
        }
    }

    private func finish() {
        withAnimation(.easeIn(duration: 0.35)) { showing = nil }
        milestones.dismissCurrent()
    }
}

/// "Your moments": everything earned, and what's still to come.
struct MomentsGalleryView: View {
    @Environment(MilestoneStore.self) private var milestones
    @Environment(\.dismiss) private var dismiss
    @State private var replaying: UnlockedMilestone?

    private let columns = [GridItem(.flexible(), spacing: FLSpacing.s), GridItem(.flexible(), spacing: FLSpacing.s)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FLSpacing.l) {
                    Text("\(milestones.unlocked.count) of \(Milestone.allCases.count) moments")
                        .flTextStyle(.body)
                        .foregroundStyle(FLColor.textSecondary)

                    LazyVGrid(columns: columns, spacing: FLSpacing.s) {
                        ForEach(Array(milestones.all.enumerated()), id: \.element.milestone) { index, entry in
                            tile(entry.milestone, entry.unlocked)
                                .flAppear(index / 2)
                        }
                    }
                }
                .padding(.horizontal, FLSpacing.gutter)
                .padding(.bottom, FLSpacing.xxl)
            }
            .scrollIndicators(.hidden)
            .flSoftTopEdge()
            .background(FLColor.background.ignoresSafeArea())
            .navigationTitle("Your moments")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .fullScreenCover(item: $replaying) { moment in
                MomentCelebrationView(moment: moment, isReplay: true) { replaying = nil }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.gallery")
    }

    @ViewBuilder
    private func tile(_ milestone: Milestone, _ unlocked: UnlockedMilestone?) -> some View {
        if let unlocked {
            Button { replaying = unlocked } label: {
                VStack(alignment: .leading, spacing: FLSpacing.xs) {
                    MomentMedal(milestone: milestone, diameter: 56, showsGlow: false)
                        .frame(width: 56, height: 56)
                        .accessibilityHidden(true)
                    Spacer(minLength: FLSpacing.s)
                    Text(milestone.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(unlocked.formattedDate)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding(FLSpacing.m)
                .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
                .background(
                    LinearGradient(colors: milestone.palette, startPoint: .bottom, endPoint: .top),
                    in: RoundedRectangle(cornerRadius: FLRadius.large, style: .continuous)
                )
            }
            .buttonStyle(FLPressableStyle(scale: 0.97, highlights: false))
            .accessibilityIdentifier("moments.tile.\(milestone.rawValue)")
        } else {
            VStack(alignment: .leading, spacing: FLSpacing.xs) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(FLColor.textTertiary)
                Spacer(minLength: FLSpacing.s)
                Text(milestone.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(milestone.hint)
                    .font(.caption)
                    .foregroundStyle(FLColor.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(FLSpacing.m)
            .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
            .flSurface(FLColor.surface, radius: FLRadius.large)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(milestone.title), locked. \(milestone.hint).")
        }
    }
}

/// A row that opens the gallery, with the latest moments as colour dots.
struct MomentsRow: View {
    @Environment(MilestoneStore.self) private var milestones
    let action: () -> Void

    private var latest: [Milestone] {
        milestones.unlocked.values.sorted { $0.date > $1.date }.prefix(4).map(\.milestone)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: FLSpacing.s) {
                ZStack {
                    if latest.isEmpty {
                        Circle().fill(FLColor.surfaceElevated).frame(width: 28, height: 28)
                    }
                    ForEach(Array(latest.enumerated()), id: \.element) { index, milestone in
                        Circle()
                            .fill(LinearGradient(colors: milestone.palette, startPoint: .bottom, endPoint: .top))
                            .frame(width: 28, height: 28)
                            .overlay(Circle().strokeBorder(FLColor.background, lineWidth: 2))
                            .offset(x: CGFloat(index) * 16)
                    }
                }
                .frame(width: 28 + CGFloat(max(latest.count - 1, 0)) * 16, alignment: .leading)

                VStack(alignment: .leading, spacing: 1) {
                    Text("Your moments")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FLColor.textPrimary)
                    Text("\(milestones.unlocked.count) of \(Milestone.allCases.count) earned")
                        .font(.footnote)
                        .foregroundStyle(FLColor.textSecondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FLColor.textTertiary)
            }
            .padding(.horizontal, FLSpacing.m)
            .padding(.vertical, FLSpacing.s)
            .frame(maxWidth: .infinity, alignment: .leading)
            .flSurface(FLColor.surface, radius: FLRadius.medium)
            .contentShape(Rectangle())
        }
        .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
        .accessibilityIdentifier("homeMoments")
    }
}
