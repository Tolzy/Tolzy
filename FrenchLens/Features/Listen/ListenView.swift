import SwiftUI

/// "Listen while you watch": capture the French playing in Instagram (or any
/// app) without downloading or screen-recording anything.
struct ListenView: View {
    @Environment(ListenSession.self) private var session
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @Environment(\.motion) private var motion

    @State private var trigger = BroadcastTrigger()

    var body: some View {
        ZStack {
            FLColor.background.ignoresSafeArea()
            ZStack {
                switch session.phase {
                case .idle, .starting:
                    intro.transition(.flReveal)
                case .listening(let since):
                    listening(since: since).transition(.flReveal)
                case .stopping:
                    saving.transition(.flReveal)
                }
            }
            .padding(.horizontal, FLSpacing.gutter)
        }
        // The real system picker, invisible, opened from our own button.
        .background(alignment: .bottomTrailing) {
            BroadcastPickerHost(trigger: trigger)
                .frame(width: 1, height: 1)
                .opacity(0.02)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .flAnimation(.reveal, value: phaseKind)
        .flHaptic(trigger: phaseKind) { _, new in
            new == 2 ? FLHaptic.success : nil
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(FLColor.background)
        .presentationCornerRadius(FLRadius.sheet)
    }

    private var phaseKind: Int {
        switch session.phase {
        case .idle: 0
        case .starting: 1
        case .listening: 2
        case .stopping: 3
        }
    }

    // MARK: Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                BrandMark()
                Spacer()
                IconButton(systemImage: "xmark", accessibilityLabel: "Close") { dismiss() }
            }
            .padding(.top, FLSpacing.l)

            Spacer(minLength: FLSpacing.l)

            ListeningWaveform(isActive: session.phase == .starting, height: 40)
                .padding(.bottom, FLSpacing.l)
                .flAppear(0)

            Text("Listen while\nyou watch")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .accessibilityAddTraits(.isHeader)
                .flAppear(1, distance: 24)

            Text("Play a Reel in Instagram, or anything in French, and FrenchLens turns what you hear into a lesson.")
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, FLSpacing.s)
                .flAppear(2)

            VStack(alignment: .leading, spacing: FLSpacing.m) {
                ListenStep(number: 1, text: "Tap **Start listening**, then **Start Broadcast**.")
                    .flAppear(3)
                ListenStep(number: 2, text: "Open Instagram and play the Reel **with sound on**.")
                    .flAppear(4)
                ListenStep(number: 3, text: "Come back and tap **Build my lesson**.")
                    .flAppear(5)
            }
            .padding(.top, FLSpacing.xl)

            Spacer(minLength: FLSpacing.l)

            VStack(spacing: FLSpacing.s) {
                PrimaryButton(
                    session.phase == .starting ? "Waiting for iOS…" : "Start listening",
                    systemImage: "waveform"
                ) {
                    session.markStarting()
                    trigger.open()
                }
                .accessibilityIdentifier("startListening")

                Text("Uses iOS screen broadcasting. FrenchLens keeps only the sound and one still frame, on this iPhone. Up to 3 minutes.")
                    .font(.footnote)
                    .foregroundStyle(FLColor.textTertiary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.bottom, FLSpacing.l)
            .flAppear(6)
        }
    }

    // MARK: Listening

    private func listening(since: Date) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: FLSpacing.xs) {
                Circle()
                    .fill(FLColor.error)
                    .frame(width: 8, height: 8)
                    .phaseAnimator([1.0, 0.35]) { dot, opacity in dot.opacity(motion.allowsMovement ? opacity : 1) } animation: { _ -> Animation? in
                        Animation.easeInOut(duration: 0.9)
                    }
                Text("Listening")
                    .flTextStyle(.label)
                    .foregroundStyle(FLColor.textSecondary)
                Spacer()
                TimelineView(.periodic(from: since, by: 1)) { context in
                    Text(Self.clock(context.date.timeIntervalSince(since)))
                        .font(.system(.subheadline, design: .monospaced, weight: .medium))
                        .foregroundStyle(FLColor.textSecondary)
                        .contentTransition(.numericText())
                        .accessibilityLabel("Listening for \(Int(context.date.timeIntervalSince(since))) seconds")
                }
            }
            .padding(.top, FLSpacing.l)

            Spacer()

            ListeningWaveform(isActive: true, barCount: 9, height: 72)
                .frame(maxWidth: .infinity)
                .padding(.bottom, FLSpacing.xl)

            Text("Now play the Reel.")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .flAppear(0, distance: 24)
            Text("Keep the sound on. When it's finished, come back here.")
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .padding(.top, FLSpacing.s)
                .flAppear(1)

            Spacer()

            VStack(spacing: FLSpacing.s) {
                PrimaryButton("Build my lesson", systemImage: "sparkles") {
                    session.requestStop()
                }
                .accessibilityIdentifier("buildFromListening")
                SecondaryButton("Open Instagram", systemImage: "arrow.up.forward.app") {
                    openURL(URL(string: "instagram://")!) { accepted in
                        if !accepted { openURL(URL(string: "https://www.instagram.com/reels/")!) }
                    }
                }
            }
            .padding(.bottom, FLSpacing.l)
            .flAppear(2)
        }
    }

    private var saving: some View {
        VStack(spacing: FLSpacing.l) {
            Spacer()
            LensPulse(size: 52)
            Text("Saving what you heard…")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textPrimary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    static func clock(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

private struct ListenStep: View {
    let number: Int
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: FLSpacing.m) {
            Text("\(number)")
                .font(.system(.title3, design: .monospaced, weight: .semibold))
                .foregroundStyle(number == 1 ? FLColor.accent : FLColor.textTertiary)
                .frame(width: 22, alignment: .leading)
            Text(text)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}
