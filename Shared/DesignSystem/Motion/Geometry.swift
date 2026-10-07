import SwiftUI

// MARK: - Matched geometry

/// `matchedGeometryEffect` that turns itself off under Reduce Motion, where
/// a selection should cross-fade into place rather than travel.
private struct MatchedGeometryModifier<ID: Hashable>: ViewModifier {
    let id: ID
    let namespace: Namespace.ID
    var isSource: Bool
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        if motion.allowsMovement {
            content.matchedGeometryEffect(id: id, in: namespace, isSource: isSource)
        } else {
            content
        }
    }
}

extension View {
    func flMatchedGeometry<ID: Hashable>(id: ID, in namespace: Namespace.ID, isSource: Bool = true) -> some View {
        modifier(MatchedGeometryModifier(id: id, namespace: namespace, isSource: isSource))
    }
}

// MARK: - Zoom navigation (iOS 18+)

extension View {
    /// Marks the view a navigation push zooms out of (e.g. a lesson thumbnail).
    /// No-op before iOS 18. The system honours Reduce Motion.
    @ViewBuilder
    func flZoomSource<ID: Hashable>(id: ID, in namespace: Namespace.ID) -> some View {
        if #available(iOS 18.0, *) {
            matchedTransitionSource(id: id, in: namespace)
        } else {
            self
        }
    }

    /// Makes a pushed destination zoom from the matching `flZoomSource`.
    @ViewBuilder
    func flZoomDestination<ID: Hashable>(id: ID, in namespace: Namespace.ID) -> some View {
        if #available(iOS 18.0, *) {
            navigationTransition(.zoom(sourceID: id, in: namespace))
        } else {
            self
        }
    }
}
