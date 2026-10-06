import SwiftUI

/// An idiom: literal vs. natural meaning, register and level.
struct ExpressionCard: View {
    let expression: ExpressionItem
    let level: CEFRLevel
    var isSpeaking = false
    var onSpeak: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            HStack(alignment: .firstTextBaseline) {
                FrenchText(expression.phrase, style: .french)
                Spacer(minLength: FLSpacing.s)
                if let onSpeak {
                    SpeakButton(isPlaying: isSpeaking, action: onSpeak)
                }
            }

            VStack(alignment: .leading, spacing: FLSpacing.s) {
                MeaningLine(label: "Literally", value: "“\(expression.literal)”", isPrimary: false)
                MeaningLine(label: "Means", value: expression.natural, isPrimary: true)
            }

            HStack(spacing: FLSpacing.xs) {
                Text(expression.register.title)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(FLColor.textSecondary)
                Text("·").foregroundStyle(FLColor.textTertiary)
                CEFRTag(level: expression.cefr)
            }

            if let note = expression.note {
                Text(note.text(for: level))
                    .flTextStyle(.bodySmall)
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let example = expression.example {
                FrenchText(example, style: .bodySmall, color: FLColor.textTertiary)
                    .italic()
            }
        }
        .padding(.vertical, FLSpacing.l)
        .overlay(alignment: .bottom) { Hairline() }
        .accessibilityIdentifier("expression.\(expression.phrase)")
    }
}

private struct MeaningLine: View {
    let label: String
    let value: String
    let isPrimary: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .flTextStyle(.label)
                .foregroundStyle(FLColor.textTertiary)
            Text(value)
                .font(isPrimary ? .body.weight(.semibold) : .body)
                .foregroundStyle(isPrimary ? FLColor.textPrimary : FLColor.textSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}
