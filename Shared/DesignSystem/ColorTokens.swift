import SwiftUI
import UIKit

/// Semantic colour tokens. Views reference these, never raw colours, so the
/// palette can be re-skinned (e.g. from Figma variables) in one place.
///
/// FrenchLens is designed dark-first: near-black, warm white text, and a single
/// electric blue used only as a deliberate signal.
enum FLColor {
    // Surfaces
    static let background = Color(light: 0xF6F4F0, dark: 0x0A0A0B)
    static let surface = Color(light: 0xFFFFFF, dark: 0x141416)
    static let surfaceElevated = Color(light: 0xEEEBE6, dark: 0x1D1D20)
    static let surfacePressed = Color(light: 0xE4E0DA, dark: 0x26262A)

    // Text
    static let textPrimary = Color(light: 0x141413, dark: 0xF4F1EA)
    static let textSecondary = Color(light: 0x6A6862, dark: 0x9C9A94)
    static let textTertiary = Color(light: 0x9C9A94, dark: 0x5E5D59)
    static let textOnAccent = Color(light: 0xFFFFFF, dark: 0xFFFFFF)

    // Lines
    static let separator = Color(light: 0x141413, dark: 0xF4F1EA, alpha: 0.08)
    static let hairline = Color(light: 0x141413, dark: 0xF4F1EA, alpha: 0.14)

    // Signal
    static let accent = Color(light: 0x0B5CFF, dark: 0x3D7EFF)
    static let accentSoft = Color(light: 0x0B5CFF, dark: 0x3D7EFF, alpha: 0.16)

    // Status
    static let success = Color(light: 0x1E8E4E, dark: 0x45C47A)
    static let warning = Color(light: 0xB86E00, dark: 0xF2A93B)
    static let error = Color(light: 0xC8312B, dark: 0xFF6259)
    static let info = Color(light: 0x3A6EA5, dark: 0x7FA8D8)

    // Media
    static let scrim = Color.black.opacity(0.55)
}

extension Color {
    /// A colour that resolves per trait collection from two hex values.
    init(light: UInt32, dark: UInt32, alpha: CGFloat = 1) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light, alpha: alpha)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
