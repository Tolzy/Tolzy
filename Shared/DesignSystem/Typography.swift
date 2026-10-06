import SwiftUI

/// Typography tokens built on the native SF Pro text styles, so every style
/// scales with Dynamic Type.
enum FLTextStyle: CaseIterable {
    /// Large editorial headline, e.g. "Bonjour."
    case display
    /// Editorial French sentences in the lesson.
    case french
    case title
    case headline
    case body
    case bodySmall
    case caption
    /// Small uppercase overline, e.g. "WHAT THEY SAID".
    case label
    case mono

    var font: Font {
        switch self {
        case .display: .system(.largeTitle, design: .default, weight: .bold)
        case .french: .system(.title, design: .default, weight: .semibold)
        case .title: .system(.title2, design: .default, weight: .semibold)
        case .headline: .system(.headline, design: .default, weight: .semibold)
        case .body: .system(.body, design: .default, weight: .regular)
        case .bodySmall: .system(.subheadline, design: .default, weight: .regular)
        case .caption: .system(.footnote, design: .default, weight: .regular)
        case .label: .system(.caption, design: .default, weight: .semibold)
        case .mono: .system(.footnote, design: .monospaced, weight: .regular)
        }
    }

    /// Optical tracking. Large type is tightened; labels are opened up.
    var tracking: CGFloat {
        switch self {
        case .display: -0.8
        case .french: -0.5
        case .title: -0.3
        case .label: 1.2
        default: 0
        }
    }

    var lineSpacing: CGFloat {
        switch self {
        case .french: 4
        case .body, .bodySmall: 2
        default: 0
        }
    }

    var isUppercase: Bool { self == .label }
}

/// Font shorthands for places that only need the font.
enum FLFont {
    static let display = FLTextStyle.display.font
    static let french = FLTextStyle.french.font
    static let title = FLTextStyle.title.font
    static let headline = FLTextStyle.headline.font
    static let body = FLTextStyle.body.font
    static let bodySmall = FLTextStyle.bodySmall.font
    static let caption = FLTextStyle.caption.font
    static let label = FLTextStyle.label.font
    static let mono = FLTextStyle.mono.font
}

private struct FLTextStyleModifier: ViewModifier {
    let style: FLTextStyle

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .lineSpacing(style.lineSpacing)
            .textCase(style.isUppercase ? .uppercase : nil)
    }
}

extension View {
    /// Applies a typography token: font, tracking, line spacing and case.
    func flTextStyle(_ style: FLTextStyle) -> some View {
        modifier(FLTextStyleModifier(style: style))
    }
}
