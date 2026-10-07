import SwiftUI

// Transitions built on the iOS 17 `Transition` protocol. Each one reads
// Reduce Motion itself, so call sites can't forget: with it on, every
// transition collapses to a plain cross-fade.

/// Rises a few points while sharpening into place. The default entrance.
struct RevealTransition: Transition {
    var distance: CGFloat = 14

    func body(content: Content, phase: TransitionPhase) -> some View {
        content.modifier(RevealEffect(isIdentity: phase.isIdentity, distance: distance))
    }
}

/// A floating surface lifting in from below, slightly scaled.
struct PanelTransition: Transition {
    func body(content: Content, phase: TransitionPhase) -> some View {
        content.modifier(PanelEffect(phase: phase))
    }
}

/// Directional slide for paged content (review cards, lesson sections).
/// Insertion travels in from `direction`; removal only fades and drifts a
/// little the other way, so it never fights the incoming content.
struct SlideTransition: Transition {
    /// +1 = forward (comes from trailing), -1 = backward (comes from leading).
    var direction: Double = 1
    var distance: CGFloat = 36

    func body(content: Content, phase: TransitionPhase) -> some View {
        content.modifier(SlideEffect(phase: phase, direction: direction, distance: distance))
    }
}

/// In-place replacement: blur and scale cross-fade (text, panel contents).
struct SwapTransition: Transition {
    func body(content: Content, phase: TransitionPhase) -> some View {
        content.modifier(SwapEffect(isIdentity: phase.isIdentity))
    }
}

extension Transition where Self == RevealTransition {
    static var flReveal: RevealTransition { RevealTransition() }
    static func flReveal(distance: CGFloat) -> RevealTransition { RevealTransition(distance: distance) }
}

extension Transition where Self == PanelTransition {
    static var flPanel: PanelTransition { PanelTransition() }
}

extension Transition where Self == SlideTransition {
    static func flSlide(direction: Double, distance: CGFloat = 36) -> SlideTransition {
        SlideTransition(direction: direction, distance: distance)
    }
}

extension Transition where Self == SwapTransition {
    static var flSwap: SwapTransition { SwapTransition() }
}

// MARK: Effects

private struct RevealEffect: ViewModifier {
    let isIdentity: Bool
    let distance: CGFloat
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        let moves = motion.allowsMovement && !isIdentity
        content
            .opacity(isIdentity ? 1 : 0)
            .offset(y: moves ? distance : 0)
            .blur(radius: moves ? 5 : 0)
    }
}

private struct PanelEffect: ViewModifier {
    let phase: TransitionPhase
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        let moves = motion.allowsMovement && !phase.isIdentity
        content
            .opacity(phase.isIdentity ? 1 : 0)
            .scaleEffect(moves ? 0.94 : 1, anchor: .bottom)
            .offset(y: moves ? (phase == .willAppear ? 48 : 28) : 0)
    }
}

private struct SlideEffect: ViewModifier {
    let phase: TransitionPhase
    let direction: Double
    let distance: CGFloat
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        let moves = motion.allowsMovement && !phase.isIdentity
        // willAppear: value -1 → enters from +direction; didDisappear: +1 → drifts to -direction.
        let travel = phase == .willAppear ? distance : distance * 0.35
        content
            .opacity(phase.isIdentity ? 1 : 0)
            .offset(x: moves ? CGFloat(-phase.value * direction) * travel : 0)
            .scaleEffect(moves ? 0.985 : 1)
    }
}

private struct SwapEffect: ViewModifier {
    let isIdentity: Bool
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        let moves = motion.allowsMovement && !isIdentity
        content
            .opacity(isIdentity ? 1 : 0)
            .blur(radius: moves ? 6 : 0)
            .scaleEffect(moves ? 0.97 : 1)
    }
}
