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
        let d = diameter
        return ZStack {
            LinearGradient(colors: [Self.deep, Self.mid, Self.pale], startPoint: .top, endPoint: .bottom)
            horizon(t: t, d: d)
            ForEach(0..<5, id: \.self) { index in
                cloud(index: index, t: t, d: d)
            }
            topSky(t: t, d: d)
        }
        .frame(width: d, height: d)
        .compositingGroup()
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Color.white.opacity(0.18), lineWidth: 0.5))
    }

    /// A slow band of light, like the horizon of a cloud bank.
    private func horizon(t: Double, d: CGFloat) -> some View {
        let x: CGFloat = CGFloat(sin(t * 0.35)) * d * 0.12
        let y: CGFloat = d * 0.2 + CGFloat(sin(t * 0.5)) * d * 0.06
        let tilt: Double = sin(t * 0.25) * 10
        return Ellipse()
            .fill(Color.white.opacity(0.85))
            .frame(width: d * 1.5, height: d * 0.55)
            .offset(x: x, y: y)
            .rotationEffect(.degrees(tilt))
            .blur(radius: d * 0.09)
    }

    private func cloud(index: Int, t: Double, d: CGFloat) -> some View {
        let i = Double(index)
        let k = CGFloat(i)
        let speedX: Double = 0.42 + i * 0.11
        let speedY: Double = 0.33 + i * 0.07
        let waveX: Double = sin(t * speedX + i * 1.7)
        let waveY: Double = cos(t * speedY + i * 2.3)
        let x: CGFloat = CGFloat(waveX) * d * 0.34
        let y: CGFloat = CGFloat(waveY) * d * 0.16 + d * 0.08
        let width: CGFloat = d * (0.45 + 0.08 * k)
        let height: CGFloat = d * (0.24 + 0.03 * k)
        let blur: CGFloat = d * (0.06 + 0.012 * k)
        let opacity: Double = 0.55 + 0.08 * i
        return Ellipse()
            .fill(Color.white.opacity(opacity))
            .frame(width: width, height: height)
            .offset(x: x, y: y)
            .blur(radius: blur)
    }

    /// Deep blue sky pooling at the top.
    private func topSky(t: Double, d: CGFloat) -> some View {
        let x: CGFloat = CGFloat(cos(t * 0.3)) * d * 0.1
        return Ellipse()
            .fill(Self.deep.opacity(0.9))
            .frame(width: d * 1.2, height: d * 0.5)
            .offset(x: x, y: -d * 0.42)
            .blur(radius: d * 0.1)
    }
}
