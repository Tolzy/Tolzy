import SwiftUI

/// The floating panel that explains a tapped word without leaving the lesson.
///
/// The panel surface persists while the learner hops between words; only its
/// contents swap (blur cross-fade) and its height springs to fit. Dragging it
/// down follows the finger with rubber-banding and dismisses past a threshold.
struct WordPopover: View {
    let selection: TokenSelection
    let level: CEFRLevel
    var isSpeaking = false
    let onSpeak: () -> Void
    let onClose: () -> Void

    @Environment(\.motion) private var motion
    @GestureState private var drag: CGFloat = 0

    var body: some View {
        WordPopoverContent(
            selection: selection,
            level: level,
            isSpeaking: isSpeaking,
            onSpeak: onSpeak,
            onClose: onClose
        )
        .id(selection.id)
        .transition(.flSwap)
        .padding(FLSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .top) {
            RoundedRectangle(cornerRadius: FLRadius.large, style: .continuous)
                .fill(FLColor.surfaceElevated)
                .overlay(
                    RoundedRectangle(cornerRadius: FLRadius.large, style: .continuous)
                        .strokeBorder(FLColor.separator, lineWidth: 0.5)
                )
                .overlay(alignment: .top) {
                    Capsule()
                        .fill(FLColor.hairline)
                        .frame(width: 36, height: 4)
                        .padding(.top, 7)
                }
                .flElevation(.floating)
        }
        .padding(.horizontal, FLSpacing.s)
        .offset(y: rubberBand(drag))
        .scaleEffect(motion.allowsMovement ? 1 - min(max(drag, 0), 200) / 4000 : 1, anchor: .bottom)
        .gesture(
            DragGesture(minimumDistance: 8)
                .updating($drag) { value, state, _ in state = value.translation.height }
                .onEnded { value in
                    if value.translation.height > 70 || value.predictedEndTranslation.height > 180 {
                        onClose()
                    }
                }
        )
        .flAnimation(.panel, value: drag == 0)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("wordPopover")
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape, onClose)
    }

    /// Follows the finger downward; resists upward pulls.
    private func rubberBand(_ y: CGFloat) -> CGFloat {
        y >= 0 ? y : -sqrt(-y) * 2
    }
}

private struct WordPopoverContent: View {
    let selection: TokenSelection
    let level: CEFRLevel
    let isSpeaking: Bool
    let onSpeak: () -> Void
    let onClose: () -> Void

    @Environment(\.motion) private var motion
    @State private var showsAllForms = false

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
                    ForEach(Array((showsAllForms ? forms : Array(forms.prefix(3))).enumerated()), id: \.element.id) { index, row in
                        let isUsed = row.form.lowercased() == bareToken
                        Text(AttributedString.french(row.phrase))
                            .font(.body.weight(isUsed ? .semibold : .regular))
                            .foregroundStyle(isUsed ? FLColor.accent : FLColor.textSecondary)
                            .transition(.flReveal(distance: 6))
                            .flAppear(index, distance: 6)
                    }
                    if forms.count > 3 {
                        Button(showsAllForms ? "Fewer forms" : "All forms") {
                            motion.perform(.reveal) { showsAllForms.toggle() }
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
    }
}
