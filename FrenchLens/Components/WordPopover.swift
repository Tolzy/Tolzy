import SwiftUI

/// The floating panel that explains a tapped word without leaving the lesson.
struct WordPopover: View {
    let selection: TokenSelection
    let level: CEFRLevel
    var isSpeaking = false
    let onSpeak: () -> Void
    let onClose: () -> Void

    @State private var showsAllForms = false
    @State private var dragOffset: CGFloat = 0

    private var gloss: WordGloss { selection.gloss }

    /// The tapped word without punctuation or elided pronoun ("J'ai" → "ai").
    private var bareToken: String {
        var word = selection.token.text.lowercased()
            .trimmingCharacters(in: .punctuationCharacters.union(.whitespaces))
        for prefix in ["j'", "j’", "l'", "l’", "d'", "d’", "c'", "c’", "n'", "n’", "qu'", "qu’"] where word.hasPrefix(prefix) {
            word.removeFirst(prefix.count)
        }
        return word
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            HStack(alignment: .firstTextBaseline) {
                Text(AttributedString.french(gloss.lemma.uppercased()))
                    .font(.system(.title3, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(FLColor.textPrimary)
                    .accessibilityIdentifier("wordPopover.lemma")
                Spacer()
                SpeakButton(isPlaying: isSpeaking, action: onSpeak)
                IconButton(systemImage: "xmark", accessibilityLabel: "Close", size: 30, action: onClose)
            }

            Text(gloss.english)
                .font(.system(.title2, weight: .regular))
                .foregroundStyle(FLColor.textPrimary)

            if let forms = gloss.forms, !forms.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(showsAllForms ? forms : Array(forms.prefix(3))) { row in
                        let isUsed = row.form.lowercased() == bareToken
                        Text(AttributedString.french(row.phrase))
                            .font(.body.weight(isUsed ? .semibold : .regular))
                            .foregroundStyle(isUsed ? FLColor.accent : FLColor.textSecondary)
                    }
                    if forms.count > 3 {
                        Button(showsAllForms ? "Fewer forms" : "All forms") {
                            withAnimation(FLMotion.snappy) { showsAllForms.toggle() }
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FLColor.textTertiary)
                        .buttonStyle(.plain)
                        .padding(.top, 2)
                    }
                }
            }

            if let note = gloss.note {
                Text(note.text(for: level))
                    .flTextStyle(.bodySmall)
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text("\(gloss.cefr.rawValue) · \(gloss.partOfSpeech)")
                .flTextStyle(.mono)
                .foregroundStyle(FLColor.textTertiary)
        }
        .padding(FLSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flSurface(FLColor.surfaceElevated, radius: FLRadius.large, elevation: .floating)
        .padding(.horizontal, FLSpacing.s)
        .offset(y: max(dragOffset, 0))
        .gesture(
            DragGesture()
                .onChanged { dragOffset = $0.translation.height }
                .onEnded { value in
                    if value.translation.height > 60 {
                        onClose()
                    }
                    withAnimation(FLMotion.spring) { dragOffset = 0 }
                }
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("wordPopover")
        .accessibilityAddTraits(.isModal)
    }
}
