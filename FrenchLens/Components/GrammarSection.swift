import SwiftUI

/// Grammar that appears in the content, anchored to the exact excerpt.
struct GrammarSection: View {
    let point: GrammarPoint
    let level: CEFRLevel
    var speakingID: String?
    var onSpeak: ((String, String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            HStack(alignment: .firstTextBaseline) {
                Text(point.title.uppercased())
                    .font(.system(.subheadline, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(FLColor.textPrimary)
                Spacer()
                CEFRTag(level: point.cefr)
            }

            HStack(alignment: .top, spacing: FLSpacing.s) {
                RoundedRectangle(cornerRadius: 1)
                    .fill(FLColor.accent)
                    .frame(width: 2)
                FrenchText("“\(point.excerpt)”", style: .title)
            }
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text("From the video: ") + Text(AttributedString.french(point.excerpt)))

            Text(point.pattern)
                .flTextStyle(.mono)
                .foregroundStyle(FLColor.textSecondary)

            Text(point.explanation.text(for: level))
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textPrimary.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)

            if !point.examples.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(point.examples, id: \.self) { example in
                        HStack {
                            FrenchText(example, style: .body, color: FLColor.textSecondary)
                            Spacer()
                            if let onSpeak {
                                let id = "grammar.\(point.id).\(example)"
                                SpeakButton(isPlaying: speakingID == id) { onSpeak(example, id) }
                            }
                        }
                    }
                }
            }
        }
        .padding(.vertical, FLSpacing.l)
        .overlay(alignment: .bottom) { Hairline() }
        .accessibilityIdentifier("grammar.\(point.id)")
    }
}
