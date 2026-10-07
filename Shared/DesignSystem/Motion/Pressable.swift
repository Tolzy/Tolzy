import SwiftUI

/// Tactile press feedback for rows and custom tappable surfaces: a small
/// spring compression and a soft highlight. Scale is dropped under Reduce Motion.
struct FLPressableStyle: ButtonStyle {
    var scale: CGFloat = 0.975
    var highlights = true

    func makeBody(configuration: Configuration) -> some View {
        PressableBody(configuration: configuration, scale: scale, highlights: highlights)
    }
}

private struct PressableBody: View {
    let configuration: ButtonStyleConfiguration
    let scale: CGFloat
    let highlights: Bool
    @Environment(\.motion) private var motion

    var body: some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .fill(FLColor.surface)
                    .padding(.horizontal, -FLSpacing.xs)
                    .opacity(highlights && configuration.isPressed ? 1 : 0)
            )
            .scaleEffect(configuration.isPressed && motion.allowsMovement ? scale : 1)
            .animation(motion.animation(.tap), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == FLPressableStyle {
    static var flPressable: FLPressableStyle { FLPressableStyle() }
}
