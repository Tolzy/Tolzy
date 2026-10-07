import CoreMotion
import Observation
import SwiftUI

/// The moment's card: glass on colour, with the learner's own detail.
/// Drawn without materials so it can also be rendered into a share image.
struct MomentCard: View {
    let moment: UnlockedMilestone
    var learnerName: String = ""
    /// -1…1 on each axis: where the light catches the card.
    var sheen: CGSize = .zero
    var width: CGFloat = 300

    private var milestone: Milestone { moment.milestone }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("FRENCHLENS · MOMENT")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.6)
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
            }

            icon
                .padding(.top, 28)

            Text(milestone.title)
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.5)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)
                .accessibilityIdentifier("moment.title")

            Text(milestone.message)
                .font(.system(size: 16))
                .foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            Text(moment.detail)
                .font(.system(size: 15, weight: .medium))
                .italic()
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.12)))
                .padding(.top, 18)

            Spacer(minLength: 24)

            HStack(alignment: .lastTextBaseline) {
                Text(moment.formattedDate)
                Spacer()
                if !learnerName.isEmpty { Text(learnerName).fontWeight(.semibold) }
            }
            .font(.system(size: 13))
            .foregroundStyle(.white.opacity(0.75))
        }
        .padding(24)
        .frame(width: width, height: width * 1.3, alignment: .topLeading)
        .background(cardSurface)
        .overlay(sheenLayer)
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .strokeBorder(
                    LinearGradient(colors: [.white.opacity(0.55), .white.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1
                )
        )
        .shadow(color: .black.opacity(0.35), radius: 30, x: 0, y: 20)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moment.card")
    }

    private var icon: some View {
        Image(systemName: milestone.systemImage)
            .font(.system(size: 30, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 68, height: 68)
            .background(
                Circle().fill(
                    LinearGradient(colors: milestone.palette.reversed(), startPoint: .topLeading, endPoint: .bottomTrailing)
                )
            )
            .overlay(Circle().strokeBorder(.white.opacity(0.4), lineWidth: 1))
            .shadow(color: milestone.glow.opacity(0.6), radius: 16)
    }

    private var cardSurface: some View {
        ZStack {
            LinearGradient(
                colors: [.white.opacity(0.22), .white.opacity(0.06)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            RadialGradient(colors: [milestone.glow.opacity(0.35), .clear], center: .topTrailing, startRadius: 10, endRadius: width)
        }
    }

    /// A band of light that slides across the card as it tilts.
    private var sheenLayer: some View {
        let x: CGFloat = 0.5 + sheen.width * 0.6
        let y: CGFloat = 0.5 + sheen.height * 0.6
        return LinearGradient(
            stops: [
                .init(color: .clear, location: 0.3),
                .init(color: .white.opacity(0.28), location: 0.5),
                .init(color: .clear, location: 0.7),
            ],
            startPoint: UnitPoint(x: x - 0.6, y: y - 0.6),
            endPoint: UnitPoint(x: x + 0.6, y: y + 0.6)
        )
        .blendMode(.plusLighter)
        .allowsHitTesting(false)
    }
}

/// How the phone is tilted, so the card can catch the light like a
/// holographic card. Relative to how it was held when the moment appeared.
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

/// The image people share: the card on its gradient, story-sized.
struct MomentShareImage: View {
    let moment: UnlockedMilestone
    var learnerName: String = ""

    var body: some View {
        ZStack {
            LinearGradient(colors: moment.milestone.palette, startPoint: .bottom, endPoint: .top)
            RadialGradient(colors: [moment.milestone.glow.opacity(0.45), .clear], center: .top, startRadius: 0, endRadius: 420)
            VStack(spacing: 0) {
                Spacer()
                MomentCard(moment: moment, learnerName: learnerName, sheen: CGSize(width: -0.4, height: -0.3), width: 290)
                Spacer()
                VStack(spacing: 4) {
                    Text("FrenchLens")
                        .font(.system(size: 20, weight: .bold))
                    Text("Turn the French you scroll past into lessons.")
                        .font(.system(size: 12))
                        .opacity(0.8)
                }
                .foregroundStyle(.white)
                .padding(.bottom, 40)
            }
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
