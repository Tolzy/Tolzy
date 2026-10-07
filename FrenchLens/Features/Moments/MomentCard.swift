import CoreMotion
import Observation
import SwiftUI

/// The moment's medal, in the spirit of Apple Fitness awards: a metal coin
/// with a polished rim and an embossed symbol. It has real thickness when
/// it turns, shows FrenchLens on the back, and a highlight that slides
/// across it as it tilts.
struct MomentMedal: View {
    let milestone: Milestone
    var diameter: CGFloat = 220
    /// Rotation around the vertical axis, in degrees. 0 = face on.
    var spin: Double = 0
    /// −1…1, for the highlight.
    var tilt: CGSize = .zero
    var showsGlow = true

    private var radians: Double { spin * .pi / 180 }
    private var showsBack: Bool { cos(radians) < 0 }

    var body: some View {
        ZStack {
            if showsGlow {
                Circle()
                    .fill(milestone.glow)
                    .frame(width: diameter * 0.9, height: diameter * 0.9)
                    .blur(radius: diameter * 0.22)
                    .opacity(0.65)
            }
            edge
            Group {
                if showsBack {
                    back.scaleEffect(x: -1, y: 1)
                } else {
                    face
                }
            }
            .rotation3DEffect(.degrees(spin), axis: (x: 0, y: 1, z: 0), perspective: 0.35)
        }
        .frame(width: diameter * 1.3, height: diameter * 1.3)
        .accessibilityElement()
        .accessibilityLabel("\(milestone.title) medal")
        .accessibilityIdentifier("moment.medal")
    }

    /// Stacked rims behind the face give the coin its thickness edge-on.
    private var edge: some View {
        let depth: Double = sin(radians)
        return ZStack {
            ForEach(0..<7, id: \.self) { layer in
                Circle()
                    .fill(rimColor)
                    .overlay(Circle().fill(Color.black.opacity(0.25 + Double(layer) * 0.04)))
                    .frame(width: diameter, height: diameter)
                    .rotation3DEffect(.degrees(spin), axis: (x: 0, y: 1, z: 0), perspective: 0.35)
                    .offset(x: CGFloat(Double(layer + 1) * depth * 1.3))
            }
        }
    }

    private var rimColor: Color {
        let palette = milestone.palette
        return palette[min(1, palette.count - 1)]
    }

    private var metal: AngularGradient {
        let p = milestone.palette
        return AngularGradient(
            colors: [.white, p[2], p[1], .white, p[2], p[1], .white],
            center: .center,
            angle: .degrees(spin * 0.5 + Double(tilt.width) * 40)
        )
    }

    private var face: some View {
        let p = milestone.palette
        let inner: CGFloat = diameter * 0.8
        return ZStack {
            // Polished rim.
            Circle().fill(metal)
            // Inner field.
            Circle()
                .fill(RadialGradient(colors: [p[1], p[0]], center: .init(x: 0.4, y: 0.3), startRadius: 4, endRadius: inner * 0.7))
                .frame(width: inner, height: inner)
                .overlay(Circle().strokeBorder(.white.opacity(0.35), lineWidth: 1).frame(width: inner, height: inner))
                .shadow(color: .black.opacity(0.35), radius: 4, x: 0, y: 2)
            // Embossed symbol: dark below, light above.
            Image(systemName: milestone.systemImage)
                .font(.system(size: diameter * 0.3, weight: .semibold))
                .foregroundStyle(
                    LinearGradient(colors: [.white, p[2]], startPoint: .top, endPoint: .bottom)
                )
                .shadow(color: .black.opacity(0.45), radius: 2, x: 0, y: 2)
                .shadow(color: .white.opacity(0.4), radius: 0, x: 0, y: -1)
            highlight
        }
        .frame(width: diameter, height: diameter)
        .clipShape(Circle())
    }

    private var back: some View {
        let p = milestone.palette
        return ZStack {
            Circle().fill(metal)
            Circle()
                .fill(LinearGradient(colors: [p[0], p[1]], startPoint: .bottom, endPoint: .top))
                .frame(width: diameter * 0.8, height: diameter * 0.8)
            VStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: diameter * 0.12, weight: .semibold))
                Text("FrenchLens")
                    .font(.system(size: diameter * 0.1, weight: .bold))
                Text(milestone.title.uppercased())
                    .font(.system(size: diameter * 0.045, weight: .semibold))
                    .tracking(1)
                    .multilineTextAlignment(.center)
                    .frame(width: diameter * 0.6)
            }
            .foregroundStyle(.white.opacity(0.85))
            highlight
        }
        .frame(width: diameter, height: diameter)
        .clipShape(Circle())
    }

    /// Specular sheen sliding with tilt and spin.
    private var highlight: some View {
        let x: CGFloat = 0.3 + tilt.width * 0.35 + CGFloat(sin(radians)) * 0.4
        let y: CGFloat = 0.25 + tilt.height * 0.25
        return LinearGradient(
            stops: [
                .init(color: .white.opacity(0), location: 0),
                .init(color: .white.opacity(0.45), location: 0.48),
                .init(color: .white.opacity(0), location: 0.62),
            ],
            startPoint: UnitPoint(x: x - 0.5, y: y - 0.5),
            endPoint: UnitPoint(x: x + 0.5, y: y + 0.5)
        )
        .blendMode(.plusLighter)
        .allowsHitTesting(false)
    }
}

/// How the phone is tilted, relative to how it was held when the moment
/// appeared, so the medal catches the light.
@Observable
final class TiltMotion {
    private(set) var tilt: CGSize = .zero

    private let manager = CMMotionManager()
    @ObservationIgnored private var reference: CMAttitude?

    func start() {
        guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
        reference = nil
        manager.deviceMotionUpdateInterval = 1.0 / 60
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self, let attitude = motion?.attitude else { return }
            if let reference = self.reference {
                attitude.multiply(byInverseOf: reference)
            } else {
                self.reference = attitude.copy() as? CMAttitude
                return
            }
            let x = max(-1, min(1, attitude.roll / 0.45))
            let y = max(-1, min(1, attitude.pitch / 0.45))
            self.tilt = CGSize(width: x, height: y)
        }
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
        tilt = .zero
    }
}

/// The image people share: medal, words and brand on the moment's colours.
struct MomentShareImage: View {
    let moment: UnlockedMilestone
    var learnerName: String = ""

    private var milestone: Milestone { moment.milestone }

    var body: some View {
        ZStack {
            LinearGradient(colors: milestone.palette, startPoint: .bottom, endPoint: .top)
            LinearGradient(colors: [.black.opacity(0.25), .clear, .black.opacity(0.4)], startPoint: .top, endPoint: .bottom)
            VStack(spacing: 0) {
                Text(learnerName.isEmpty ? "A FRENCHLENS MOMENT" : "\(learnerName.uppercased())’S FRENCHLENS MOMENT")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.6)
                    .foregroundStyle(.white.opacity(0.8))
                    .padding(.top, 56)
                Spacer()
                MomentMedal(milestone: milestone, diameter: 170, tilt: CGSize(width: -0.3, height: -0.2))
                Text(milestone.title)
                    .font(.system(size: 28, weight: .bold))
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
                Text(moment.detail)
                    .font(.system(size: 15, weight: .medium))
                    .italic()
                    .multilineTextAlignment(.center)
                    .opacity(0.9)
                    .padding(.top, 10)
                    .padding(.horizontal, 36)
                Text(moment.formattedDate)
                    .font(.system(size: 13))
                    .opacity(0.7)
                    .padding(.top, 14)
                Spacer()
                VStack(spacing: 4) {
                    Text("FrenchLens")
                        .font(.system(size: 20, weight: .bold))
                    Text("Turn the French you scroll past into lessons.")
                        .font(.system(size: 12))
                        .opacity(0.8)
                }
                .padding(.bottom, 44)
            }
            .foregroundStyle(.white)
        }
        .frame(width: 360, height: 640)
    }

    /// 1080 × 1920, ready for Stories.
    @MainActor
    static func render(_ moment: UnlockedMilestone, learnerName: String) -> UIImage? {
        let renderer = ImageRenderer(content: MomentShareImage(moment: moment, learnerName: learnerName))
        renderer.scale = 3
        return renderer.uiImage
    }
}
