import SwiftUI

/// A living sphere of sky: soft clouds drift inside a blue globe. It breathes
/// with the microphone while listening, pulses with each word Camille says,
/// and slows to a calm swirl while she thinks. Under Reduce Motion it rests
/// and only changes size.
struct VoiceOrb: View {
    enum Mood: Equatable { case resting, listening, thinking, speaking, muted }

    var mood: Mood
    /// 0…1 loudness (microphone or speech).
    var level: Double
    var diameter: CGFloat = 220

    @Environment(\.motion) private var motion

    private static let deep = Color(red: 0.16, green: 0.36, blue: 0.96)
    private static let mid = Color(red: 0.42, green: 0.60, blue: 1.0)
    private static let pale = Color(red: 0.86, green: 0.90, blue: 1.0)

    private var scale: CGFloat {
        switch mood {
        case .resting: 1
        case .listening: 1 + CGFloat(level) * 0.16
        case .thinking: 0.86
        case .speaking: 1.02 + CGFloat(level) * 0.1
        case .muted: 0.9
        }
    }

    /// How fast the clouds drift.
    private var drift: Double {
        switch mood {
        case .thinking: 1.6
        case .speaking: 1.1
        case .listening: 0.7 + level * 0.8
        default: 0.45
        }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !motion.allowsMovement)) { context in
            let time = motion.allowsMovement ? context.date.timeIntervalSinceReferenceDate : 0
            sky(time: time)
        }
        .frame(width: diameter, height: diameter)
        .scaleEffect(scale)
        .saturation(mood == .muted ? 0.15 : 1)
        .opacity(mood == .muted ? 0.75 : 1)
        .animation(.spring(duration: 0.28, bounce: 0.2), value: scale)
        .animation(.easeInOut(duration: 0.4), value: mood)
        .accessibilityHidden(true)
    }

    private func sky(time: TimeInterval) -> some View {
        let t = time * drift
        return ZStack {
            LinearGradient(colors: [Self.deep, Self.mid, Self.pale], startPoint: .top, endPoint: .bottom)

            // A slow band of light, like the horizon of a cloud bank.
            Ellipse()
                .fill(Color.white.opacity(0.85))
                .frame(width: diameter * 1.5, height: diameter * 0.55)
                .offset(x: CGFloat(sin(t * 0.35)) * diameter * 0.12,
                        y: diameter * 0.2 + CGFloat(sin(t * 0.5)) * diameter * 0.06)
                .rotationEffect(.degrees(sin(t * 0.25) * 10))
                .blur(radius: diameter * 0.09)

            ForEach(0..<5, id: \.self) { index in
                let i = Double(index)
                Ellipse()
                    .fill(Color.white.opacity(0.55 + 0.08 * i))
                    .frame(width: diameter * (0.45 + 0.08 * i), height: diameter * (0.24 + 0.03 * i))
                    .offset(
                        x: CGFloat(sin(t * (0.42 + i * 0.11) + i * 1.7)) * diameter * 0.34,
                        y: CGFloat(cos(t * (0.33 + i * 0.07) + i * 2.3)) * diameter * 0.16 + diameter * 0.08
                    )
                    .blur(radius: diameter * (0.06 + 0.012 * i))
            }

            // Deep blue sky pooling at the top.
            Ellipse()
                .fill(Self.deep.opacity(0.9))
                .frame(width: diameter * 1.2, height: diameter * 0.5)
                .offset(x: CGFloat(cos(t * 0.3)) * diameter * 0.1, y: -diameter * 0.42)
                .blur(radius: diameter * 0.1)
        }
        .frame(width: diameter, height: diameter)
        .compositingGroup()
        .clipShape(Circle())
        .overlay(
            Circle().strokeBorder(Color.white.opacity(0.18), lineWidth: 0.5)
        )
    }
}
