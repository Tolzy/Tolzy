import SwiftUI

/// A card, opened: zooms out of the deck into a full page, like opening a
/// Strava workout. The gradient header carries the French; below it, the
/// meaning in context, an example to hear, the conjugation and a note; the
/// decision sits at the bottom.
struct FlashcardDetailView: View {
    let card: Flashcard
    let onKnown: () -> Void
    let onPractise: () -> Void

    @Environment(\.tts) private var tts

    private var palette: [Color] { card.kind.palette }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                VStack(alignment: .leading, spacing: FLSpacing.l) {
                    metaRow
                    meaning
                    if let example = card.example, !example.isEmpty { exampleBlock(example) }
                    if !card.conjugation.isEmpty { conjugation }
                    if let note = card.note, !note.isEmpty { section("Good to know") { bodyText(note) } }
                    Text("From “\(card.lessonTitle)”")
                        .font(.footnote)
                        .foregroundStyle(FLColor.textTertiary)
                }
                .padding(FLSpacing.gutter)
                .padding(.bottom, 140)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(FLColor.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { actions }
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { tts.stop() }
    }

    // MARK: Pieces

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            FlashcardGloss(palette: palette)
            VStack(alignment: .leading, spacing: FLSpacing.s) {
                Text(card.kind.label.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(.white.opacity(0.75))
                HStack(alignment: .bottom) {
                    Text(AttributedString.french(card.front))
                        .font(.system(size: 40, weight: .heavy))
                        .tracking(-0.8)
                        .foregroundStyle(.white)
                        .minimumScaleFactor(0.5)
                        .lineLimit(2)
                    Spacer(minLength: FLSpacing.s)
                    Image(systemName: card.kind.symbol)
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Button {
                    speak(card.front, id: "detail.front")
                } label: {
                    Label("Hear it", systemImage: "speaker.wave.2.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(.white.opacity(0.2)))
                }
                .buttonStyle(FLPressableStyle(scale: 0.94, highlights: false))
            }
            .padding(FLSpacing.gutter)
            .padding(.bottom, FLSpacing.s)
        }
        .frame(height: 300)
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var metaRow: some View {
        HStack(spacing: FLSpacing.xl) {
            meta("Level", card.level.rawValue)
            meta("Type", card.kind.label)
            meta("Form", card.hint)
        }
    }

    private func meta(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(FLColor.textTertiary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FLColor.textPrimary)
                .lineLimit(1)
        }
    }

    /// The meaning, set apart like Strava's "Athlete Intelligence" note.
    private var meaning: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xs) {
            Label("What it means", systemImage: "sparkles")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette[1])
            Text(card.meaning)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("deck.meaning")
            if let literal = card.literal, !literal.isEmpty {
                Text("Literally: \(literal)")
                    .font(.subheadline)
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(FLSpacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: FLRadius.large, style: .continuous)
                .fill(palette[1].opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: FLRadius.large, style: .continuous)
                .strokeBorder(palette[1].opacity(0.25), lineWidth: 1)
        )
    }

    private func exampleBlock(_ example: String) -> some View {
        section("In a sentence") {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(AttributedString.french(example))
                        .font(.body.weight(.medium))
                        .foregroundStyle(FLColor.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let translation = card.exampleTranslation, !translation.isEmpty {
                        Text(translation)
                            .font(.subheadline)
                            .foregroundStyle(FLColor.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: FLSpacing.s)
                Button { speak(example, id: "detail.example") } label: {
                    Image(systemName: "speaker.wave.2.fill")
                        .foregroundStyle(palette[1])
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(palette[1].opacity(0.12)))
                }
                .accessibilityLabel("Hear the sentence")
            }
        }
    }

    private var conjugation: some View {
        let columns = [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)]
        return section("Conjugation") {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                ForEach(card.conjugation) { row in
                    let isUsed = row.form == card.highlightedForm
                    HStack(spacing: 6) {
                        Text(row.pronoun)
                            .foregroundStyle(FLColor.textTertiary)
                        Text(row.form)
                            .fontWeight(isUsed ? .bold : .regular)
                            .foregroundStyle(isUsed ? palette[1] : FLColor.textPrimary)
                    }
                    .font(.body)
                }
            }
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            Text(title)
                .font(.title3.weight(.bold))
                .foregroundStyle(FLColor.textPrimary)
            content()
        }
    }

    private func bodyText(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(FLColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var actions: some View {
        VStack(spacing: FLSpacing.xs) {
            Button {
                tts.stop()
                onKnown()
            } label: {
                Label("I know this", systemImage: "checkmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(Capsule().fill(FLColor.accent))
            }
            .buttonStyle(FLPressableStyle(scale: 0.97, highlights: false))
            .accessibilityIdentifier("deck.known")

            Button {
                tts.stop()
                onPractise()
            } label: {
                Text("Keep practising")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(FLColor.accent)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(FLPressableStyle(scale: 0.97, highlights: false))
            .accessibilityIdentifier("deck.practise")
        }
        .padding(.horizontal, FLSpacing.gutter)
        .padding(.top, FLSpacing.s)
        .padding(.bottom, FLSpacing.xs)
        .background(alignment: .top) {
            // Content fades under the buttons instead of being cut off.
            LinearGradient(colors: [FLColor.background.opacity(0), FLColor.background], startPoint: .top, endPoint: .center)
                .padding(.top, -30)
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private func speak(_ text: String, id: String) {
        if tts.isSpeaking(id) { tts.stop() } else { tts.speak(text, id: id, rate: .slow) }
    }
}
