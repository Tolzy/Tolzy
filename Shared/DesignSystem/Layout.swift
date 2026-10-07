import SwiftUI

/// Spacing scale (4pt base).
enum FLSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let s: CGFloat = 12
    static let m: CGFloat = 16
    static let l: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    static let xxxl: CGFloat = 64

    /// Horizontal page margin.
    static let gutter: CGFloat = 24
}

/// Corner radii. Used sparingly: most content sits directly on the background.
enum FLRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 14
    static let large: CGFloat = 22
    static let sheet: CGFloat = 32
}

// Motion lives in DesignSystem/Motion (MotionToken, transitions, choreography).

/// Depth tokens.
enum FLElevation {
    case flat, raised, floating

    var radius: CGFloat {
        switch self {
        case .flat: 0
        case .raised: 12
        case .floating: 32
        }
    }

    var y: CGFloat {
        switch self {
        case .flat: 0
        case .raised: 4
        case .floating: 16
        }
    }

    var opacity: Double {
        switch self {
        case .flat: 0
        case .raised: 0.18
        case .floating: 0.45
        }
    }
}

extension View {
    func flElevation(_ elevation: FLElevation) -> some View {
        shadow(color: .black.opacity(elevation.opacity), radius: elevation.radius, x: 0, y: elevation.y)
    }

    /// A content surface: fill, hairline edge and optional depth.
    func flSurface(
        _ fill: Color = FLColor.surface,
        radius: CGFloat = FLRadius.medium,
        elevation: FLElevation = .flat
    ) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(fill)
                .overlay(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .strokeBorder(FLColor.separator, lineWidth: 0.5)
                )
                .flElevation(elevation)
        )
    }
}
