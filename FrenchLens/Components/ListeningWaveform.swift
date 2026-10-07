import SwiftUI

/// Live "listening" bars. Each bar breathes on its own rhythm; under Reduce
/// Motion they rest at varied heights.
struct ListeningWaveform: View {
    var isActive: Bool
    var barCount = 7
    var height: CGFloat = 44

    @Environment(\.motion) private var motion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !isActive || !motion.allowsMovement)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 5) {
                ForEach(0..<barCount, id: \.self) { index in
                    Capsule()
                        .fill(index == barCount / 2 ? FLColor.accent : FLColor.textPrimary.opacity(0.85))
                        .frame(width: 5, height: barHeight(index: index, time: time))
                }
            }
            .frame(height: height)
        }
        .accessibilityHidden(true)
    }

    private func barHeight(index: Int, time: TimeInterval) -> CGFloat {
        let resting = [0.35, 0.6, 0.45, 0.9, 0.5, 0.7, 0.4]
        let base = resting[index % resting.count]
        guard isActive, motion.allowsMovement else { return height * base * 0.6 }
        let speed = 2.2 + Double(index % 3) * 0.7
        let wave = (sin(time * speed + Double(index) * 0.9) + 1) / 2
        return max(6, height * (0.25 + 0.75 * wave * base + 0.15 * base))
    }
}
