import SwiftUI

// MARK: - Motion intents
//
// Screens never pick curves. They state an *intent* and the motion system
// decides how that intent moves — and how it degrades under Reduce Motion.
// Every animation in FrenchLens traces back to one of these tokens, so the
// app's feel can be retuned (or mapped to Figma motion specs) in one place.

enum MotionToken: String, CaseIterable, Identifiable {
    /// Direct feedback to a touch: pressed states, toggles. Fast, no bounce.
    case tap
    /// A selection moving between options: underlines, word highlight.
    case select
    /// Content entering the screen.
    case reveal
    /// Floating surfaces: the word panel, toasts.
    case panel
    /// One piece of content replacing another in place.
    case swap
    /// A small beat of acknowledgement: saved, correct.
    case emphasis
    /// Slow, looping atmosphere: breathing, shimmer.
    case ambient

    var id: String { rawValue }

    var animation: Animation {
        switch self {
        case .tap: .spring(duration: 0.22, bounce: 0)
        case .select: .spring(duration: 0.38, bounce: 0.12)
        case .reveal: .spring(duration: 0.6, bounce: 0)
        case .panel: .spring(duration: 0.46, bounce: 0.16)
        case .swap: .spring(duration: 0.34, bounce: 0)
        case .emphasis: .spring(duration: 0.42, bounce: 0.38)
        case .ambient: .easeInOut(duration: 1.6)
        }
    }

    /// Under Reduce Motion: a short cross-fade, or nothing at all for
    /// motion that only exists for delight.
    var reducedAnimation: Animation? {
        switch self {
        case .ambient, .emphasis: nil
        default: .easeInOut(duration: 0.2)
        }
    }

    var summary: String {
        switch self {
        case .tap: "Pressed states and toggles"
        case .select: "Selection moving between options"
        case .reveal: "Content entering"
        case .panel: "Floating surfaces"
        case .swap: "Content replaced in place"
        case .emphasis: "Acknowledgement beats"
        case .ambient: "Slow loops"
        }
    }
}

// MARK: - Motion policy in the environment

/// The resolved motion policy for a view tree.
struct Motion {
    var reduceMotion: Bool

    /// The animation for an intent, honouring Reduce Motion.
    func animation(_ token: MotionToken) -> Animation? {
        (reduceMotion || MotionRuntime.isDisabled) ? token.reducedAnimation : token.animation
    }

    /// `withAnimation` for an intent.
    @discardableResult
    func perform<Result>(_ token: MotionToken, _ body: () throws -> Result) rethrows -> Result {
        try withAnimation(animation(token), body)
    }

    /// Whether things may travel across the screen (vs. only fade).
    var allowsMovement: Bool { !reduceMotion && !MotionRuntime.isDisabled }

    /// Starts an ambient loop (breathing, drifting light), or does nothing
    /// under Reduce Motion — ambient motion is never essential.
    func loop(duration: Double, autoreverses: Bool = true, _ body: () -> Void) {
        guard allowsMovement else { return }
        withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: autoreverses), body)
    }
}

/// Process-wide switches (e.g. UI tests run with motion off for determinism).
enum MotionRuntime {
    nonisolated(unsafe) static var isDisabled = false
}

private struct MotionKey: EnvironmentKey {
    static let defaultValue = Motion(reduceMotion: false)
}

extension EnvironmentValues {
    /// Read with `@Environment(\.motion)`; install with `.motionEnvironment()`.
    var motion: Motion {
        get { self[MotionKey.self] }
        set { self[MotionKey.self] = newValue }
    }
}

private struct MotionEnvironmentModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.environment(\.motion, Motion(reduceMotion: reduceMotion))
    }
}

extension View {
    /// Installs the motion policy (reads Reduce Motion) for this view tree.
    /// Apply once at each root: the app window and the Share Extension.
    func motionEnvironment() -> some View {
        modifier(MotionEnvironmentModifier())
    }

    /// `.animation(_:value:)` driven by a motion intent.
    func flAnimation<V: Equatable>(_ token: MotionToken, value: V) -> some View {
        modifier(TokenAnimationModifier(token: token, value: value))
    }
}

private struct TokenAnimationModifier<V: Equatable>: ViewModifier {
    let token: MotionToken
    let value: V
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        content.animation(motion.animation(token), value: value)
    }
}
