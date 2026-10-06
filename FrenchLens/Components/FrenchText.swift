import SwiftUI

extension AttributedString {
    /// Text tagged as French so VoiceOver reads it with a French voice.
    static func french(_ string: String) -> AttributedString {
        var attributed = AttributedString(string)
        attributed.languageIdentifier = "fr-FR"
        return attributed
    }
}

/// French content set as editorial typography.
struct FrenchText: View {
    let text: String
    var style: FLTextStyle = .french
    var color: Color = FLColor.textPrimary

    init(_ text: String, style: FLTextStyle = .french, color: Color = FLColor.textPrimary) {
        self.text = text
        self.style = style
        self.color = color
    }

    var body: some View {
        Text(AttributedString.french(text))
            .flTextStyle(style)
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Small uppercase overline that introduces a section.
struct SectionHeader: View {
    let title: String
    var trailing: String?

    init(_ title: String, trailing: String? = nil) {
        self.title = title
        self.trailing = trailing
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .flTextStyle(.label)
                .foregroundStyle(FLColor.textTertiary)
            Spacer()
            if let trailing {
                Text(trailing)
                    .flTextStyle(.label)
                    .foregroundStyle(FLColor.textTertiary)
            }
        }
        .accessibilityAddTraits(.isHeader)
    }
}

/// CEFR level, set in monospaced type with a hairline edge.
struct CEFRTag: View {
    let level: CEFRLevel

    var body: some View {
        Text(level.rawValue)
            .font(.system(.caption2, design: .monospaced, weight: .semibold))
            .foregroundStyle(FLColor.textSecondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(Capsule().strokeBorder(FLColor.hairline, lineWidth: 0.5))
            .accessibilityLabel("Level \(level.rawValue)")
    }
}
