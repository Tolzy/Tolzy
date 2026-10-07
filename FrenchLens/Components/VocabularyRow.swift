import SwiftUI

struct VocabularyRow: View {
    let item: VocabularyItem
    var isSpeaking = false
    var onSpeak: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: FLSpacing.m) {
            VStack(alignment: .leading, spacing: 4) {
                Text(AttributedString.french(item.french))
                    .font(.system(.title3, weight: .semibold))
                    .foregroundStyle(FLColor.textPrimary)
                Text(item.english)
                    .flTextStyle(.bodySmall)
                    .foregroundStyle(FLColor.textSecondary)
                if let example = item.example {
                    Text(AttributedString.french(example))
                        .font(.footnote)
                        .italic()
                        .foregroundStyle(FLColor.textTertiary)
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: FLSpacing.s)
            if let onSpeak {
                SpeakButton(isPlaying: isSpeaking, action: onSpeak)
            }
            CEFRTag(level: item.cefr)
        }
        .padding(.vertical, FLSpacing.m)
        .overlay(alignment: .bottom) { Hairline() }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("vocabulary.\(item.french)")
    }
}
