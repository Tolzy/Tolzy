import Foundation

// Pure timing and mapping functions used by the motion system. Kept free of
// SwiftUI so they can be unit tested anywhere.

/// Timing for sequenced entrances.
enum Choreography {
    /// Gap between consecutive items in a staggered entrance.
    static let stagger: Double = 0.055
    /// Later items never wait longer than this, so long lists don't drag.
    static let maxDelay: Double = 0.42
    /// How long a "done" state is held before moving on (e.g. lesson ready).
    static let completionHold: Duration = .milliseconds(700)

    static func delay(for index: Int) -> Double {
        min(Double(max(index, 0)) * stagger, maxDelay)
    }
}

/// Maps a scroll offset into 0…1 progress across a range, for continuous,
/// finger-locked effects (collapsing titles, toolbar materials).
struct ScrollProgress {
    let start: CGFloat
    let end: CGFloat

    func callAsFunction(_ offset: CGFloat) -> Double {
        guard end > start else { return offset >= end ? 1 : 0 }
        return Double(min(max((offset - start) / (end - start), 0), 1))
    }
}
