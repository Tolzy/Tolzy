import SwiftUI

// MARK: - Staggered entrance

/// Fades and rises content in the first time it appears, delayed by its
/// position in a sequence, so a screen assembles in reading order rather
/// than popping in all at once. Plays once per view identity.
private struct AppearEffect: ViewModifier {
    let order: Int
    let distance: CGFloat
    @Environment(\.motion) private var motion
    @State private var isVisible = MotionRuntime.isDisabled

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible || !motion.allowsMovement ? 0 : distance)
            .onAppear {
                guard !isVisible else { return }
                let animation = motion.animation(.reveal)?.delay(motion.allowsMovement ? Choreography.delay(for: order) : 0)
                withAnimation(animation) { isVisible = true }
            }
    }
}

extension View {
    /// Joins a staggered entrance at position `order` (0 = first).
    func flAppear(_ order: Int = 0, distance: CGFloat = 18) -> some View {
        modifier(AppearEffect(order: order, distance: distance))
    }
}

// MARK: - Pop and shake (keyframes)

private struct PopValues {
    var scale: CGFloat = 1
    var rotation: Double = 0
}

/// A small spring "pop" whenever `trigger` changes — saved, correct answer.
private struct PopEffect<Trigger: Equatable>: ViewModifier {
    let trigger: Trigger
    var tilt: Double
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        if motion.allowsMovement {
            content.keyframeAnimator(initialValue: PopValues(), trigger: trigger) { view, values in
                view
                    .scaleEffect(values.scale)
                    .rotationEffect(.degrees(values.rotation))
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    SpringKeyframe(1.24, duration: 0.13, spring: .snappy)
                    SpringKeyframe(0.94, duration: 0.12, spring: .snappy)
                    SpringKeyframe(1.0, duration: 0.35, spring: .bouncy)
                }
                KeyframeTrack(\.rotation) {
                    CubicKeyframe(tilt, duration: 0.12)
                    CubicKeyframe(-tilt * 0.5, duration: 0.12)
                    SpringKeyframe(0, duration: 0.3, spring: .bouncy)
                }
            }
        } else {
            content
        }
    }
}

/// A short horizontal "no" — a wrong answer. Never used for errors that
/// need reading; those get an explicit state instead.
private struct ShakeEffect<Trigger: Equatable>: ViewModifier {
    let trigger: Trigger
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        if motion.allowsMovement {
            content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
                view.offset(x: x)
            } keyframes: { _ in
                KeyframeTrack(\.self) {
                    CubicKeyframe(-9, duration: 0.06)
                    CubicKeyframe(8, duration: 0.07)
                    CubicKeyframe(-5, duration: 0.07)
                    CubicKeyframe(3, duration: 0.06)
                    SpringKeyframe(0, duration: 0.2, spring: .smooth)
                }
            }
        } else {
            content
        }
    }
}

extension View {
    func flPop<T: Equatable>(trigger: T, tilt: Double = 0) -> some View {
        modifier(PopEffect(trigger: trigger, tilt: tilt))
    }

    func flShake<T: Equatable>(trigger: T) -> some View {
        modifier(ShakeEffect(trigger: trigger))
    }
}
