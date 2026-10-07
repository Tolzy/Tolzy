import SwiftUI

/// The FrenchLens wordmark: a small lens glyph and the name.
struct BrandMark: View {
    var size: CGFloat = 15

    var body: some View {
        HStack(spacing: 7) {
            LensGlyph()
                .frame(width: size, height: size)
            Text("FrenchLens")
                .font(.system(size: size, weight: .semibold))
                .tracking(-0.2)
                .foregroundStyle(FLColor.textPrimary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("FrenchLens")
    }
}

/// Two offset rings with a blue focal point.
struct LensGlyph: View {
    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            ZStack {
                Circle()
                    .strokeBorder(FLColor.textPrimary, lineWidth: max(1.2, side * 0.12))
                Circle()
                    .fill(FLColor.accent)
                    .frame(width: side * 0.32, height: side * 0.32)
            }
            .frame(width: side, height: side)
        }
        .accessibilityHidden(true)
    }
}

/// A hairline progress indicator with a travelling blue highlight.
/// Pass `progress` for determinate mode, or `nil` for indeterminate.
struct ProgressLine: View {
    var progress: Double?
    @Environment(\.motion) private var motion
    @State private var phase: CGFloat = -0.4

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(FLColor.hairline)
                if let progress {
                    Capsule()
                        .fill(FLColor.accent)
                        .frame(width: proxy.size.width * CGFloat(min(max(progress, 0), 1)))
                        .flAnimation(.reveal, value: progress)
                } else {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [FLColor.accent.opacity(0), FLColor.accent, FLColor.accent.opacity(0)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: proxy.size.width * 0.4)
                        // Under Reduce Motion the highlight rests in the middle.
                        .offset(x: proxy.size.width * (motion.allowsMovement ? phase : 0.3))
                }
            }
            .clipShape(Capsule())
        }
        .frame(height: 2)
        .onAppear {
            guard progress == nil else { return }
            motion.loop(duration: 1.4, autoreverses: false) { phase = 1 }
        }
        .accessibilityElement()
        .accessibilityLabel("Working")
        .accessibilityValue(progress.map { "\(Int($0 * 100)) percent" } ?? "In progress")
    }
}

/// A hairline rule.
struct Hairline: View {
    var body: some View {
        Rectangle()
            .fill(FLColor.separator)
            .frame(height: 0.5)
            .accessibilityHidden(true)
    }
}
