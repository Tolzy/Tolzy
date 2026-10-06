import SwiftUI

/// A word the learner tapped.
struct TokenSelection: Equatable, Identifiable {
    var segmentID: String
    var tokenIndex: Int
    var token: TranscriptToken
    var gloss: WordGloss

    var id: String { "\(segmentID)#\(tokenIndex)" }
}

/// The interactive, synchronised transcript.
///
/// Motion choreography:
/// - Sentences assemble in reading order on first appearance (`flAppear`).
/// - The blue word highlight *travels* between tapped words (matched geometry),
///   so the eye follows the selection instead of losing it.
/// - While a sentence is spoken, a thin accent rule glides under each word as
///   the synthesiser reaches it; the other sentences recede.
/// Under Reduce Motion all of this cross-fades in place.
struct TranscriptView: View {
    let segments: [TranscriptSegment]
    let analysis: LessonAnalysis
    /// The segment currently playing, if any.
    var activeSegmentID: String?
    /// Index of the word being spoken inside the active segment.
    var spokenTokenIndex: Int?
    var showsTranslations = true
    @Binding var selection: TokenSelection?
    var playback: SpeechPlayback?
    var onPlay: (TranscriptSegment, SpeechRate) -> Void

    @Environment(\.motion) private var motion
    @Namespace private var highlight

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xl) {
            ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                segmentView(segment)
                    .flAppear(index + 1)
            }
        }
        .flHaptic(.lookup, trigger: selection?.id)
    }

    private func segmentView(_ segment: TranscriptSegment) -> some View {
        let isActive = activeSegmentID == segment.id
        let isDimmed = activeSegmentID != nil && !isActive

        return VStack(alignment: .leading, spacing: FLSpacing.s) {
            FlowLayout(spacing: 7, lineSpacing: 6) {
                ForEach(Array(segment.tokens.enumerated()), id: \.offset) { index, token in
                    TokenView(
                        token: token,
                        isSelected: selection?.segmentID == segment.id && selection?.tokenIndex == index,
                        isSpoken: isActive && spokenTokenIndex == index,
                        namespace: highlight,
                        onTap: { select(token, at: index, in: segment) }
                    )
                }
            }
            .flAnimation(.select, value: isActive ? spokenTokenIndex : nil)
            .opacity(isDimmed ? 0.38 : 1)
            .flAnimation(.swap, value: isDimmed)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(Text(AttributedString.french(segment.text)))

            if showsTranslations, let translation = segment.translation {
                Text(translation)
                    .flTextStyle(.bodySmall)
                    .foregroundStyle(FLColor.textSecondary)
                    .opacity(isDimmed ? 0.5 : 1)
                    .fixedSize(horizontal: false, vertical: true)
            }

            AudioControls(
                isPlaying: playback?.utteranceID == LessonSpeech.segmentID(segment),
                playingRate: playback?.rate,
                onPlay: { onPlay(segment, $0) }
            )
            .padding(.top, 2)
        }
    }

    private func select(_ token: TranscriptToken, at index: Int, in segment: TranscriptSegment) {
        guard let key = token.lookup, let gloss = analysis.gloss(for: key) else { return }
        let next = TokenSelection(segmentID: segment.id, tokenIndex: index, token: token, gloss: gloss)
        // Moving between words is a selection; opening/closing is a panel.
        motion.perform(selection == nil || selection == next ? .panel : .select) {
            selection = selection == next ? nil : next
        }
    }
}

private struct TokenView: View {
    let token: TranscriptToken
    let isSelected: Bool
    let isSpoken: Bool
    let namespace: Namespace.ID
    let onTap: () -> Void

    var body: some View {
        let text = Text(AttributedString.french(token.text))
            .font(FLFont.french)
            .tracking(FLTextStyle.french.tracking)
            .underline(token.isTappable && !isSelected, pattern: .dot, color: FLColor.hairline)
            .foregroundColor(foreground)

        if token.isTappable {
            text
                .padding(.horizontal, 3)
                .background {
                    if isSelected {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(FLColor.accent)
                            .flMatchedGeometry(id: "selected-word", in: namespace)
                    }
                }
                .overlay(alignment: .bottom) { spokenRule }
                .padding(.horizontal, -3)
                .contentShape(Rectangle())
                .onTapGesture(perform: onTap)
                .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
                .accessibilityHint("Shows the meaning")
                .accessibilityIdentifier("token.\(token.text)")
        } else {
            text.overlay(alignment: .bottom) { spokenRule }
        }
    }

    @ViewBuilder
    private var spokenRule: some View {
        if isSpoken {
            Capsule()
                .fill(FLColor.accent)
                .frame(height: 2)
                .offset(y: 3)
                .flMatchedGeometry(id: "spoken-word", in: namespace)
        }
    }

    private var foreground: Color {
        if isSelected { return FLColor.textOnAccent }
        if isSpoken { return FLColor.accent }
        return FLColor.textPrimary
    }
}

/// Stable utterance identifiers so the UI knows what is being spoken.
enum LessonSpeech {
    static func segmentID(_ segment: TranscriptSegment) -> String { "segment.\(segment.id)" }
    static func wordID(_ gloss: WordGloss) -> String { "word.\(gloss.key)" }
    static func vocabularyID(_ item: VocabularyItem) -> String { "vocabulary.\(item.id)" }
    static func expressionID(_ item: ExpressionItem) -> String { "expression.\(item.id)" }
}
