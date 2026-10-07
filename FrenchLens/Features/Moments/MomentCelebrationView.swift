import SwiftUI

/// The full-screen celebration. Choreography: colour rises from the bottom
/// of the screen, the card springs up into place with a haptic, its icon
/// bounces, the words settle in, then the buttons. The card tilts with the
/// phone (or a drag) and catches the light. Under Reduce Motion everything
/// simply fades in and the card stays still.
struct MomentCelebrationView: View {
    let moment: UnlockedMilestone
    /// Replaying from the gallery rather than just earned.
    var isReplay = false
    let onDone: () -> Void

    @Environment(AppSettings.self) private var settings
    @Environment(\.motion) private var motion

    @State private var reveal: Double = 0
    @State private var cardIn = false
    @State private var textIn = false
    @State private var buttonsIn = false
    @State private var drag: CGSize = .zero
    @State private var motionTilt = TiltMotion()
    @State private var shareImage: UIImage?

    private var milestone: Milestone { moment.milestone }

    /// Phone tilt plus finger, −1…1.
    private var tilt: CGSize {
        guard motion.allowsMovement else { return .zero }
        let x = max(-1, min(1, motionTilt.tilt.width + drag.width / 140))
        let y = max(-1, min(1, motionTilt.tilt.height - drag.height / 140))
        return CGSize(width: x, height: y)
    }

    var body: some View {
        GeometryReader { proxy in
            let cardWidth: CGFloat = min(320, proxy.size.width - 56)
            ZStack {
                MomentBackdrop(palette: milestone.palette, reveal: reveal)
                SparkField(color: milestone.glow)
                    .ignoresSafeArea()
                    .opacity(cardIn ? 1 : 0)

                VStack(spacing: 0) {
                    Text(isReplay ? "Your moment" : "New moment")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.8))
                        .padding(.top, FLSpacing.l)
                        .opacity(textIn ? 1 : 0)

                    Spacer(minLength: FLSpacing.m)
                    card(width: cardWidth)
                    Spacer(minLength: FLSpacing.m)
                    buttons
                        .opacity(buttonsIn ? 1 : 0)
                        .offset(y: buttonsIn ? 0 : 16)
                }
                .padding(.horizontal, FLSpacing.gutter)
                .padding(.bottom, FLSpacing.m)
            }
        }
        .sensoryFeedback(.success, trigger: cardIn) { _, new in new }
        .onAppear(perform: enter)
        .onDisappear { motionTilt.stop() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moment.celebration")
        .accessibilityAddTraits(.isModal)
    }

    // MARK: Pieces

    private func card(width: CGFloat) -> some View {
        MomentCard(moment: moment, learnerName: settings.learnerName, sheen: tilt, width: width)
            .rotation3DEffect(.degrees(Double(tilt.width) * 12), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .rotation3DEffect(.degrees(Double(tilt.height) * -10), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
            .scaleEffect(cardIn ? 1 : 0.72)
            .offset(y: cardIn ? 0 : 140)
            .rotation3DEffect(.degrees(cardIn ? 0 : 32), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
            .opacity(cardIn ? 1 : 0)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in drag = value.translation }
                    .onEnded { _ in
                        withAnimation(.spring(duration: 0.6, bounce: 0.45)) { drag = .zero }
                    }
            )
            .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.8), value: tilt)
    }

    private var buttons: some View {
        VStack(spacing: FLSpacing.s) {
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

    // MARK: Choreography

    private func enter() {
        shareImage = MomentShareImage.render(moment, learnerName: settings.learnerName)
        guard motion.allowsMovement else {
            withAnimation(.easeOut(duration: 0.3)) {
                reveal = 1
                cardIn = true
                textIn = true
                buttonsIn = true
            }
            return
        }
        motionTilt.start()
        withAnimation(.easeOut(duration: 1.1)) { reveal = 1 }
        withAnimation(.spring(duration: 0.75, bounce: 0.32).delay(0.3)) { cardIn = true }
        withAnimation(.easeOut(duration: 0.5).delay(0.6)) { textIn = true }
        withAnimation(.spring(duration: 0.6, bounce: 0.2).delay(0.85)) { buttonsIn = true }
    }

    private func leave() {
        motionTilt.stop()
        onDone()
    }
}
