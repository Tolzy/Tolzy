import SwiftUI

/// Semantic haptics. Views say *what happened*; this decides how it feels.
/// The system already respects the user's haptics setting.
enum FLHaptic: CaseIterable {
    /// Moving between options (tabs, segments).
    case selection
    /// Tapping a word to look it up.
    case lookup
    /// A surface opening or closing (panels).
    case surface
    /// A pipeline step completing.
    case progress
    case saved
    case unsaved
    case success
    case failure

    var feedback: SensoryFeedback {
        switch self {
        case .selection: .selection
        case .lookup: .impact(flexibility: .soft, intensity: 0.7)
        case .surface: .impact(flexibility: .soft, intensity: 0.4)
        case .progress: .impact(flexibility: .solid, intensity: 0.35)
        case .saved: .impact(weight: .medium, intensity: 0.8)
        case .unsaved: .impact(weight: .light, intensity: 0.5)
        case .success: .success
        case .failure: .error
        }
    }
}

extension View {
    /// Plays `haptic` whenever `trigger` changes.
    func flHaptic<T: Equatable>(_ haptic: FLHaptic, trigger: T) -> some View {
        sensoryFeedback(haptic.feedback, trigger: trigger)
    }

    /// Chooses a haptic (or none) from the old and new trigger values.
    func flHaptic<T: Equatable>(trigger: T, _ choose: @escaping (T, T) -> FLHaptic?) -> some View {
        sensoryFeedback(trigger: trigger) { old, new -> SensoryFeedback? in
            choose(old, new)?.feedback
        }
    }
}
