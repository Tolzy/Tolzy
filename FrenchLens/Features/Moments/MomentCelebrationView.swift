import SwiftUI

/// The full-screen celebration.
///
/// Choreography: the moment's colour rises from the bottom of the screen;
/// the medal drops in spinning like a coin and settles face-on with a
/// haptic; light rays turn slowly behind it; the words and the row of
/// moments settle in; then the buttons. Drag the medal to spin it (it
/// keeps your momentum and lands face-on); tilt the phone and the light
/// moves across it. Under Reduce Motion everything fades in and rests.
struct MomentCelebrationView: View {
    let moment: UnlockedMilestone
    /// Replaying from the gallery rather than just earned.
    var isReplay = false
    let onDone: () -> Void

    @Environment(AppSettings.self) private var settings
    @Environment(MilestoneStore.self) private var milestones
    @Environment(\.motion) private var motion

    @State private var reveal: Double = 0
    @State private var medalIn = false
    @State private var textIn = false
    @State private var buttonsIn = false
    @State private var spin: Double = -540
    @State private var spinAtDragStart: Double?
    @State private var motionTilt = TiltMotion()
    @State private var shareImage: UIImage?
    @State private var landed = 0

    private var milestone: Milestone { moment.milestone }

    var body: some View {
        ZStack {
            MomentBackdrop(palette: milestone.palette, reveal: reveal)
            SparkField(color: milestone.glow)
                .ignoresSafeArea()
                .opacity(medalIn ? 1 : 0)

            VStack(spacing: 0) {
                Spacer(minLength: FLSpacing.l)
                medal
                words
                    .opacity(textIn ? 1 : 0)
                    .offset(y: textIn ? 0 : 18)
                Spacer(minLength: FLSpacing.l)
                progressRow
                    .opacity(textIn ? 1 : 0)
                    .padding(.bottom, FLSpacing.l)
                buttons
                    .opacity(buttonsIn ? 1 : 0)
                    .offset(y: buttonsIn ? 0 : 20)
            }
            .padding(.horizontal, FLSpacing.gutter)
            .padding(.bottom, FLSpacing.m)
        }
        .sensoryFeedback(.success, trigger: medalIn) { _, new in new }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.6), trigger: landed)
        .onAppear(perform: enter)
        .onDisappear { motionTilt.stop() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moment.celebration")
        .accessibilityAddTraits(.isModal)
    }

    // MARK: Pieces

    private var medal: some View {
        MomentMedal(milestone: milestone, diameter: 210, spin: spin, tilt: motionTilt.tilt)
            .scaleEffect(medalIn ? 1 : 0.35)
            .offset(y: medalIn ? 0 : -60)
            .opacity(medalIn ? 1 : 0)
            .contentShape(Circle())
            .gesture(spinGesture)
            // Rays sit behind without affecting layout.
            .background {
                LightRays(color: .white)
                    .frame(width: 520, height: 520)
                    .opacity(medalIn ? 0.9 : 0)
            }
            .frame(height: 290)
    }

    private var words: some View {
        VStack(spacing: FLSpacing.s) {
            Text(isReplay ? "Unlocked \(moment.formattedDate)" : "New moment · \(moment.formattedDate)")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(Capsule().fill(.white.opacity(0.16)))
                .overlay(Capsule().strokeBorder(.white.opacity(0.25), lineWidth: 0.5))

            Text(milestone.title)
                .font(.system(size: 34, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, FLSpacing.xs)
                .accessibilityIdentifier("moment.title")

            Text(milestone.message)
                .font(.system(size: 17))
                .foregroundStyle(.white.opacity(0.82))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Text(moment.detail)
                .font(.system(size: 15, weight: .medium))
                .italic()
                .foregroundStyle(.white.opacity(0.92))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, FLSpacing.xs)
        }
        .frame(maxWidth: 360)
    }

    /// Every moment as a dot: earned ones in their colours, this one ringed.
    private var progressRow: some View {
        VStack(spacing: FLSpacing.xs) {
            HStack(spacing: 6) {
                ForEach(Milestone.allCases) { item in
                    let earned = milestones.unlocked[item] != nil
                    Circle()
                        .fill(earned
                              ? AnyShapeStyle(LinearGradient(colors: item.palette, startPoint: .bottom, endPoint: .top))
                              : AnyShapeStyle(Color.white.opacity(0.18)))
                        .frame(width: 12, height: 12)
                        .overlay(
                            Circle()
                                .strokeBorder(.white, lineWidth: 1.5)
                                .frame(width: 18, height: 18)
                                .opacity(item == milestone ? 1 : 0)
                        )
                        .frame(width: 18, height: 18)
                }
            }
            Text("\(milestones.unlocked.count) of \(Milestone.allCases.count) moments")
                .font(.caption.weight(.medium))
                .foregroundStyle(.white.opacity(0.7))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(milestones.unlocked.count) of \(Milestone.allCases.count) moments earned")
    }

    private var buttons: some View {
        VStack(spacing: FLSpacing.xs) {
            if let shareImage {
                ShareLink(
                    item: Image(uiImage: shareImage),
                    preview: SharePreview(milestone.title, image: Image(uiImage: shareImage))
                ) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(Capsule().fill(.white))
                }
                .buttonStyle(FLPressableStyle(scale: 0.97, highlights: false))
                .accessibilityIdentifier("moment.share")
            }

            Button(action: leave) {
                Text(isReplay ? "Done" : "Continue")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .contentShape(Rectangle())
            }
            .buttonStyle(FLPressableStyle(scale: 0.97, highlights: false))
            .accessibilityIdentifier("moment.continue")
        }
    }

    // MARK: Spinning

    /// Drag sideways to spin the medal; let go and it carries on with your
    /// momentum, landing face-on.
    private var spinGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                guard motion.allowsMovement else { return }
                let start = spinAtDragStart ?? spin
                spinAtDragStart = start
                spin = start + Double(value.translation.width) * 0.9
            }
            .onEnded { value in
                guard motion.allowsMovement else { return }
                spinAtDragStart = nil
                let flick = Double(value.predictedEndTranslation.width - value.translation.width) * 0.9
                let target = ((spin + flick) / 360).rounded() * 360
                withAnimation(.spring(duration: 1.1, bounce: 0.18)) { spin = target }
                landed += 1
            }
    }

    // MARK: Choreography

    private func enter() {
        shareImage = MomentShareImage.render(moment, learnerName: settings.learnerName)
        guard motion.allowsMovement else {
            spin = 0
            withAnimation(.easeOut(duration: 0.3)) {
                reveal = 1
                medalIn = true
                textIn = true
                buttonsIn = true
            }
            return
        }
        motionTilt.start()
        withAnimation(.easeInOut(duration: 1.2)) { reveal = 1 }
        withAnimation(.spring(duration: 0.8, bounce: 0.3).delay(0.35)) { medalIn = true }
        withAnimation(.spring(duration: 1.6, bounce: 0.15).delay(0.35)) { spin = 0 }
        withAnimation(.spring(duration: 0.7, bounce: 0.2).delay(0.9)) { textIn = true }
        withAnimation(.spring(duration: 0.6, bounce: 0.2).delay(1.15)) { buttonsIn = true }
    }

    private func leave() {
        motionTilt.stop()
        onDone()
    }
}
