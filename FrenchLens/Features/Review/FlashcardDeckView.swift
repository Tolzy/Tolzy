import SwiftUI

/// A deck of cards you swipe like Tinder: right if you know it, left to keep
/// learning it. Tap a card to flip it and learn everything about it.
///
/// Feel: the card follows your finger 1:1 and pivots from below; a stamp
/// fades in as you commit; let go past the line (or flick) and it flies off
/// with your momentum while the next card rises into place. Under Reduce
/// Motion cards cross-fade and don't rotate.
struct FlashcardDeckView: View {
    @Bindable var session: FlashcardSession
    let onFinish: (_ known: Int, _ total: Int) -> Void
    let onClose: () -> Void

    @Environment(\.motion) private var motion
    @Environment(\.tts) private var tts

    @State private var drag: CGSize = .zero
    @State private var isFlipped = false
    @State private var isFlying = false
    @State private var reported = false

    /// How far you drag before letting go sends the card.
    private let threshold: CGFloat = 110

    private var verdictHint: FlashcardSession.Verdict? {
        if drag.width > 24 { return .known }
        if drag.width < -24 { return .learning }
        return nil
    }

    private var commitment: Double { min(Double(abs(drag.width) / threshold), 1) }

    var body: some View {
        VStack(spacing: FLSpacing.m) {
            header
            if session.isFinished {
                summary
                    .transition(.flReveal)
            } else {
                GeometryReader { proxy in
                    deck(size: proxy.size)
                }
                controls
            }
        }
        .padding(.top, FLSpacing.s)
        .padding(.bottom, FLSpacing.m)
        .flAnimation(.reveal, value: session.isFinished)
        .sensoryFeedback(.selection, trigger: abs(drag.width) > threshold)
        .onChange(of: session.isFinished) { _, finished in
            guard finished, !reported else { return }
            reported = true
            onFinish(session.known.count, session.cards.count)
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: FLSpacing.s) {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(FLColor.textPrimary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(FLColor.surfaceElevated))
            }
            .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
            .accessibilityLabel("End review")
            .accessibilityIdentifier("deck.close")

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(FLColor.surfaceElevated)
                    Capsule()
                        .fill(FLColor.accent)
                        .frame(width: max(8, proxy.size.width * session.progress))
                }
            }
            .frame(height: 6)
            .flAnimation(.select, value: session.progress)

            Text("\(min(session.index + 1, session.cards.count)) / \(session.cards.count)")
                .flTextStyle(.mono)
                .foregroundStyle(FLColor.textTertiary)
                .contentTransition(.numericText(value: Double(session.index)))
                .flAnimation(.select, value: session.index)
        }
    }

    // MARK: Deck

    private func deck(size: CGSize) -> some View {
        let cardHeight: CGFloat = min(size.height - 24, 520)
        let cardWidth: CGFloat = size.width
        return ZStack {
            ForEach(Array(session.upcoming.enumerated().reversed()), id: \.element.id) { depth, card in
                FlashcardFace(card: card, isFront: true)
                    .frame(width: cardWidth, height: cardHeight)
                    .scaleEffect(1 - CGFloat(depth + 1) * 0.05 + (depth == 0 ? 0.05 * commitment : 0))
                    .offset(y: CGFloat(depth + 1) * 16 - (depth == 0 ? 16 * commitment : 0))
                    .opacity(depth == 0 ? 0.75 + 0.25 * commitment : 0.45)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            if let card = session.current {
                topCard(card, width: cardWidth, height: cardHeight)
                    .id(card.id)
                    .transition(.asymmetric(insertion: .scale(scale: 0.92).combined(with: .opacity), removal: .identity))
            }
        }
        .frame(width: size.width, height: size.height)
        .animation(.spring(duration: 0.45, bounce: 0.22), value: session.index)
    }

    private func topCard(_ card: Flashcard, width: CGFloat, height: CGFloat) -> some View {
        let rotation: Double = motion.allowsMovement ? Double(drag.width / 18) : 0
        return FlipCard(angle: isFlipped ? 180 : 0) {
            FlashcardFace(card: card, isFront: true, onSpeak: { _ in speak(card.front, id: "deck.front.\(card.id)") })
        } back: {
            FlashcardFace(card: card, isFront: false, onSpeak: { speak($0, id: "deck.back.\(card.id)") })
        }
        .frame(width: width, height: height)
        .overlay(alignment: .top) { stamps }
        .offset(x: drag.width, y: drag.height * 0.4)
        .rotationEffect(.degrees(rotation), anchor: .bottom)
        .gesture(dragGesture)
        .onTapGesture { flip() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("deck.card")
        .accessibilityAction(named: "I know it") { fling(.known) }
        .accessibilityAction(named: "Still learning") { fling(.learning) }
        .accessibilityAction(named: isFlipped ? "Show the French" : "Show the meaning") { flip() }
    }

    /// "Je sais" / "À revoir", fading in as you commit.
    private var stamps: some View {
        HStack {
            stamp("JE SAIS", color: FLColor.success, angle: -12)
                .opacity(verdictHint == .known ? commitment : 0)
            Spacer()
            stamp("À REVOIR", color: FLColor.warning, angle: 12)
                .opacity(verdictHint == .learning ? commitment : 0)
        }
        .padding(28)
        .allowsHitTesting(false)
    }

    private func stamp(_ text: String, color: Color, angle: Double) -> some View {
        Text(text)
            .font(.system(size: 22, weight: .heavy))
            .tracking(1.5)
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(color, lineWidth: 3))
            .rotationEffect(.degrees(angle))
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard !isFlying else { return }
                drag = value.translation
            }
            .onEnded { value in
                guard !isFlying else { return }
                let flick = value.predictedEndTranslation.width
                if value.translation.width > threshold || flick > threshold * 2.4 {
                    fling(.known, velocity: flick)
                } else if value.translation.width < -threshold || flick < -threshold * 2.4 {
                    fling(.learning, velocity: flick)
                } else {
                    withAnimation(.spring(duration: 0.5, bounce: 0.38)) { drag = .zero }
                }
            }
    }

    // MARK: Controls

    private var controls: some View {
        HStack(spacing: FLSpacing.xl) {
            roundButton("xmark", color: FLColor.warning, size: 64, label: "Still learning", id: "deck.learning") {
                fling(.learning)
            }
            roundButton("arrow.uturn.backward", color: FLColor.textSecondary, size: 44, label: "Undo", id: "deck.undo") {
                undo()
            }
            .disabled(!session.canUndo)
            .opacity(session.canUndo ? 1 : 0.35)
            roundButton("checkmark", color: FLColor.success, size: 64, label: "I know it", id: "deck.known") {
                fling(.known)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func roundButton(_ symbol: String, color: Color, size: CGFloat, label: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size * 0.36, weight: .bold))
                .foregroundStyle(color)
                .frame(width: size, height: size)
                .background(Circle().fill(FLColor.surface))
                .overlay(Circle().strokeBorder(FLColor.hairline, lineWidth: 0.5))
                .flElevation(.raised)
        }
        .buttonStyle(FLPressableStyle(scale: 0.88, highlights: false))
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }

    // MARK: Summary

    private var summary: some View {
        VStack(alignment: .leading, spacing: FLSpacing.l) {
            Spacer(minLength: 0)
            Text(session.learning.isEmpty ? "You knew them all." : "Nice work.")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
            HStack(spacing: FLSpacing.m) {
                tally(session.known.count, "known", color: FLColor.success)
                tally(session.learning.count, "to review", color: FLColor.warning)
            }
            if !session.learning.isEmpty {
                PrimaryButton("Go again with \(session.learning.count)", systemImage: "arrow.clockwise") {
                    reported = false
                    motion.perform(.reveal) { session.reviewLearningAgain() }
                }
                .accessibilityIdentifier("deck.again")
            }
            SecondaryButton("Done") { onClose() }
                .accessibilityIdentifier("deck.done")
            Spacer(minLength: 0)
        }
        .accessibilityIdentifier("deck.summary")
    }

    private func tally(_ value: Int, _ label: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .contentTransition(.numericText(value: Double(value)))
            Text(label)
                .font(.subheadline)
                .foregroundStyle(FLColor.textSecondary)
        }
        .padding(FLSpacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flSurface(FLColor.surface, radius: FLRadius.large)
    }

    // MARK: Actions

    private func flip() {
        guard !isFlying else { return }
        if motion.allowsMovement {
            withAnimation(.spring(duration: 0.55, bounce: 0.2)) { isFlipped.toggle() }
        } else {
            withAnimation(.easeInOut(duration: 0.2)) { isFlipped.toggle() }
        }
    }

    /// Sends the top card off-screen in the swipe direction, keeping the
    /// finger's momentum, then brings the next card up.
    private func fling(_ verdict: FlashcardSession.Verdict, velocity: CGFloat = 0) {
        guard !isFlying, session.current != nil else { return }
        isFlying = true
        tts.stop()
        let direction: CGFloat = verdict == .known ? 1 : -1
        let distance: CGFloat = 640 + min(abs(velocity) * 0.3, 400)
        let lift: CGFloat = drag.height + (motion.allowsMovement ? -40 : 0)
        withAnimation(.spring(duration: 0.4, bounce: 0)) {
            drag = CGSize(width: direction * distance, height: lift)
        }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(230))
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                drag = .zero
                isFlipped = false
            }
            session.mark(verdict)
            isFlying = false
        }
    }

    private func undo() {
        guard session.canUndo, !isFlying else { return }
        withAnimation(.spring(duration: 0.45, bounce: 0.25)) {
            isFlipped = false
            drag = .zero
            session.undo()
        }
    }

    private func speak(_ text: String, id: String) {
        if tts.isSpeaking(id) { tts.stop() } else { tts.speak(text, id: id, rate: .slow) }
    }
}

/// Shows the front until it turns edge-on, then the back, so a flip reads
/// as one physical card rather than two views cross-fading.
private struct FlipCard<Front: View, Back: View>: View, Animatable {
    var angle: Double
    @ViewBuilder var front: () -> Front
    @ViewBuilder var back: () -> Back

    var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    var body: some View {
        ZStack {
            front()
                .opacity(angle < 90 ? 1 : 0)
                .accessibilityHidden(angle >= 90)
            back()
                .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                .opacity(angle >= 90 ? 1 : 0)
                .accessibilityHidden(angle < 90)
        }
        .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.45)
    }
}

/// One face of a card.
struct FlashcardFace: View {
    let card: Flashcard
    let isFront: Bool
    var onSpeak: ((String) -> Void)?

    init(card: Flashcard, isFront: Bool, onSpeak: ((String) -> Void)? = nil) {
        self.card = card
        self.isFront = isFront
        self.onSpeak = onSpeak
    }

    private var tint: Color {
        switch card.kind {
        case .word: FLColor.accent
        case .expression: Color.hex(0x8E5BE8)
        case .verb: Color.hex(0x14A38B)
        }
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(FLColor.surface)
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(LinearGradient(colors: [tint.opacity(isFront ? 0.16 : 0.08), .clear], startPoint: .top, endPoint: .center))
            if isFront { front } else { back }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .strokeBorder(FLColor.hairline, lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.12), radius: 24, x: 0, y: 14)
    }

    private var chip: some View {
        Text(card.kind.label.uppercased())
            .font(.system(size: 11, weight: .bold))
            .tracking(1.2)
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(tint.opacity(0.14)))
    }

    private var front: some View {
        VStack(spacing: FLSpacing.m) {
            HStack {
                chip
                Spacer()
                Text(card.level.rawValue)
                    .flTextStyle(.mono)
                    .foregroundStyle(FLColor.textTertiary)
            }
            Spacer()
            Text(AttributedString.french(card.front))
                .font(.system(size: 36, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(FLColor.textPrimary)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
                .accessibilityIdentifier("deck.front")
            Text(card.hint)
                .font(.subheadline)
                .foregroundStyle(FLColor.textSecondary)
            if let onSpeak {
                Button { onSpeak(card.front) } label: {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                        .frame(width: 48, height: 48)
                        .background(Circle().fill(tint.opacity(0.12)))
                }
                .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
                .accessibilityLabel("Hear it")
                .padding(.top, FLSpacing.xs)
            }
            Spacer()
            Label("Tap to learn more", systemImage: "hand.tap")
                .font(.footnote)
                .foregroundStyle(FLColor.textTertiary)
        }
        .padding(FLSpacing.l)
    }

    private var back: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FLSpacing.m) {
                HStack {
                    chip
                    Spacer()
                    Text(AttributedString.french(card.front))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FLColor.textSecondary)
                        .lineLimit(1)
                }

                Text(card.meaning)
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.4)
                    .foregroundStyle(FLColor.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("deck.meaning")

                if let literal = card.literal, !literal.isEmpty {
                    detail("Literally", literal)
                }

                if let example = card.example, !example.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(AttributedString.french(example))
                                .font(.body.weight(.medium))
                                .foregroundStyle(FLColor.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                            if let onSpeak {
                                Button { onSpeak(example) } label: {
                                    Image(systemName: "speaker.wave.2")
                                        .foregroundStyle(tint)
                                }
                                .accessibilityLabel("Hear the example")
                            }
                        }
                        if let translation = card.exampleTranslation, !translation.isEmpty {
                            Text(translation)
                                .font(.subheadline)
                                .foregroundStyle(FLColor.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(FLSpacing.s)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous).fill(FLColor.surfaceElevated))
                }

                if !card.conjugation.isEmpty {
                    conjugation
                }

                if let note = card.note, !note.isEmpty {
                    detail("Good to know", note)
                }

                Text("From “\(card.lessonTitle)”")
                    .font(.footnote)
                    .foregroundStyle(FLColor.textTertiary)
            }
            .padding(FLSpacing.l)
        }
        .scrollIndicators(.hidden)
    }

    private func detail(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .flTextStyle(.label)
                .foregroundStyle(FLColor.textTertiary)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var conjugation: some View {
        let columns = [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)]
        return VStack(alignment: .leading, spacing: FLSpacing.xs) {
            Text("CONJUGATION")
                .flTextStyle(.label)
                .foregroundStyle(FLColor.textTertiary)
            LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
                ForEach(card.conjugation) { row in
                    let isUsed = row.form == card.highlightedForm
                    HStack(spacing: 4) {
                        Text(row.pronoun)
                            .foregroundStyle(FLColor.textTertiary)
                        Text(row.form)
                            .fontWeight(isUsed ? .bold : .regular)
                            .foregroundStyle(isUsed ? tint : FLColor.textPrimary)
                    }
                    .font(.subheadline)
                }
            }
        }
    }
}
