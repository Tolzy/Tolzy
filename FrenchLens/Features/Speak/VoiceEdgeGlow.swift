import SwiftUI

/// Siri-style light around the edges of the screen while a voice
/// conversation is live. A wash of colour rises from the bottom, then a
/// soft rainbow border hugs the screen's rounded corners, flowing slowly
/// and swelling with the voice. Under Reduce Motion it fades in and rests.
struct VoiceEdgeGlow: View {
    enum Mood: Equatable { case listening, thinking, speaking, quiet }

    var mood: Mood
    /// 0…1 loudness (microphone or speech).
    var level: Double

    @Environment(\.motion) private var motion
    @State private var reveal: Double = 0
    @State private var wash: Double = 0

    /// Close to the corner radius of current iPhone displays; the blur
    /// hides small differences between models.
    private let cornerRadius: CGFloat = 58

    private static let colors: [Color] = [
        Color(red: 1.00, green: 0.62, blue: 0.04),  // orange
        Color(red: 1.00, green: 0.18, blue: 0.47),  // pink
        Color(red: 0.75, green: 0.35, blue: 0.95),  // purple
        Color(red: 0.04, green: 0.52, blue: 1.00),  // blue
        Color(red: 0.39, green: 0.82, blue: 1.00),  // cyan
        Color(red: 1.00, green: 0.62, blue: 0.04),  // back to orange
    ]

    /// How strongly the edge glows.
    private var intensity: Double {
        switch mood {
        case .listening: 0.55 + level * 0.45
        case .speaking: 0.6 + level * 0.4
        case .thinking: 0.5
        case .quiet: 0.25
        }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !motion.allowsMovement || mood == .quiet)) { context in
            let time = motion.allowsMovement ? context.date.timeIntervalSinceReferenceDate : 0
            glow(time: time)
        }
        .mask(risingMask)
        .overlay(alignment: .bottom) { entranceWash }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .animation(.spring(duration: 0.3, bounce: 0), value: intensity)
        .onAppear(perform: enter)
    }

    // MARK: Layers

    private func glow(time: TimeInterval) -> some View {
        let speed: Double = mood == .thinking ? 70 : 38
        let angle = Angle.degrees(time * speed)
        let counter = Angle.degrees(-time * speed * 0.6 + 120)
        let swell = CGFloat(intensity)
        let breathe: Double = mood == .thinking ? (sin(time * 3) + 1) / 2 * 0.25 : 0

        let bloomWidth: CGFloat = 26 + 30 * swell
        let bloomBlur: CGFloat = 26 + 14 * swell
        let bloomOpacity: Double = 0.55 * (Double(swell) + breathe)
        let depthWidth: CGFloat = 14 + 14 * swell
        let depthOpacity: Double = 0.45 * Double(swell)
        let edgeWidth: CGFloat = 5 + 3 * swell

        let gradient = AngularGradient(colors: Self.colors, center: .center, angle: angle)
        let counterGradient = AngularGradient(colors: Self.colors.reversed(), center: .center, angle: counter)
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        return ZStack {
            // Wide, soft bloom reaching into the screen.
            shape.stroke(gradient, lineWidth: bloomWidth)
                .blur(radius: bloomBlur)
                .opacity(bloomOpacity)
            // A second bloom drifting the other way, for depth.
            shape.stroke(counterGradient, lineWidth: depthWidth)
                .blur(radius: 14)
                .opacity(depthOpacity)
            // The bright edge itself.
            shape.stroke(gradient, lineWidth: edgeWidth)
                .blur(radius: 3)
                .opacity(0.9)
        }
        .drawingGroup()
    }

    /// The glow rises from the bottom edge when it appears.
    private var risingMask: some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            let span: CGFloat = height * 2.2
            let offset: CGFloat = height - CGFloat(reveal) * span
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black, location: 0.3),
                    .init(color: .black, location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: span)
            .offset(y: offset)
        }
    }

    /// A brief burst of colour from the bottom, like Siri waking up.
    private var entranceWash: some View {
        Ellipse()
            .fill(AngularGradient(colors: Self.colors, center: .center))
            .frame(height: 260)
            .scaleEffect(x: 1.4, y: 1)
            .blur(radius: 60)
            .offset(y: 160 - 220 * CGFloat(wash))
            .opacity(wash * 0.7)
    }

    private func enter() {
        guard motion.allowsMovement else {
            withAnimation(.easeOut(duration: 0.3)) { reveal = 1 }
            return
        }
        withAnimation(.easeOut(duration: 0.9)) { reveal = 1 }
        withAnimation(.easeOut(duration: 0.45)) { wash = 1 }
        withAnimation(.easeIn(duration: 0.7).delay(0.45)) { wash = 0 }
    }
}
