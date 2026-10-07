import SwiftUI

/// Review as a carousel of glossy cards, in the spirit of Strava's Instant
/// Workouts: the deck fans out with the next cards peeking behind; swipe to
/// browse (it loops); tap a card and it zooms open into everything worth
/// knowing about it.
///
/// Feel: the top card tracks your finger and tilts; the card behind rises
/// as you pull; let go past the line (or flick) and it sails off while the
/// next settles in with a soft spring. Under Reduce Motion cards cross-fade.
struct FlashcardDeckView: View {
    @Bindable var session: FlashcardSession
    let zoom: Namespace.ID
    let onOpen: (Flashcard) -> Void
    let onFinish: (_ firstTime: Int, _ total: Int) -> Void
    let onClose: () -> Void

    @Environment(\.motion) private var motion

    @State private var drag: CGFloat = 0
    @State private var isFlying = false
    @State private var reported = false
    /// Which way the last move went, so the incoming card enters from it.
    @State private var direction: CGFloat = 1

    private let threshold: CGFloat = 90

    private var pull: Double { min(Double(abs(drag) / 220), 1) }

    var body: some View {
        VStack(spacing: FLSpacing.l) {
            header
            if session.isFinished {
                summary
                    .transition(.flReveal)
            } else {
                Spacer(minLength: 0)
                GeometryReader { proxy in
                    deck(width: proxy.size.width)
                        .frame(width: proxy.size.width, height: proxy.size.height)
                }
                .frame(height: 330)
                dots
                Text("Swipe to browse · Tap a card to learn it")
                    .font(.footnote)
                    .foregroundStyle(FLColor.textTertiary)
                Spacer(minLength: 0)
            }
        }
        .padding(.top, FLSpacing.s)
        .padding(.bottom, FLSpacing.l)
        .flAnimation(.reveal, value: session.isFinished)
        .sensoryFeedback(.selection, trigger: session.index)
        .onChange(of: session.isFinished) { _, finished in
            guard finished, !reported else { return }
            reported = true
            onFinish(session.total - session.practised.count, session.total)
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            HStack {
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
                Spacer()
                Text("\(session.known.count) of \(session.total) learned")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FLColor.textSecondary)
                    .contentTransition(.numericText(value: Double(session.known.count)))
                    .flAnimation(.select, value: session.known.count)
            }
            Text("Your cards")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .padding(.top, FLSpacing.xs)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(FLColor.surfaceElevated)
                    Capsule()
                        .fill(FLColor.accent)
                        .frame(width: max(6, proxy.size.width * session.progress))
                }
            }
            .frame(height: 5)
            .flAnimation(.select, value: session.progress)
        }
    }

    // MARK: Deck

    private func deck(width: CGFloat) -> some View {
        let cardWidth: CGFloat = width - 40
        let cardHeight: CGFloat = min(cardWidth * 0.82, 310)
        let behind: [(depth: Int, card: Flashcard)] = session.upcoming.enumerated().map { (depth: $0.offset, card: $0.element) }.reversed()
        return ZStack {
            ForEach(behind, id: \.card.id) { entry in
                behindCard(entry.card, depth: entry.depth, width: cardWidth, height: cardHeight)
            }
            if let card = session.current {
                topCard(card, width: cardWidth, height: cardHeight)
                    .id(card.id)
                    .transition(entrance(width: cardWidth))
            }
        }
        .animation(.spring(duration: 0.5, bounce: 0.2), value: session.index)
        .animation(.spring(duration: 0.5, bounce: 0.2), value: session.cards.count)
    }

    /// A card waiting in the fan: further back is smaller, turned and
    /// dimmer; the nearest one rises as you pull the top card away.
    private func behindCard(_ card: Flashcard, depth: Int, width: CGFloat, height: CGFloat) -> some View {
        let rise: Double = depth == 0 ? pull : 0
        let level: Double = Double(depth + 1) - rise
        let step: CGFloat = CGFloat(level)
        let scale: CGFloat = 1 - 0.06 * step
        let angle: Double = motion.allowsMovement ? 4 * level : 0
        let x: CGFloat = 26 * step
        let y: CGFloat = 6 * step
        let opacity: Double = 1 - 0.18 * level
        return FlashcardTile(card: card)
            .frame(width: width, height: height)
            .scaleEffect(scale)
            .rotationEffect(.degrees(angle))
            .offset(x: x, y: y)
            .opacity(opacity)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    /// Going back, the previous card slides in from the left.
    private func entrance(width: CGFloat) -> AnyTransition {
        let from: CGFloat = direction < 0 ? -width : 0
        let insertion: AnyTransition = AnyTransition.offset(x: from, y: 0).combined(with: .opacity)
        return AnyTransition.asymmetric(insertion: insertion, removal: .identity)
    }

    private func topCard(_ card: Flashcard, width: CGFloat, height: CGFloat) -> some View {
        let tilt: Double = motion.allowsMovement ? Double(drag / 22) : 0
        return FlashcardTile(card: card)
            .frame(width: width, height: height)
            .flZoomSource(id: card.id, in: zoom)
            .offset(x: drag)
            .rotationEffect(.degrees(tilt), anchor: .bottom)
            .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .gesture(swipe)
            .onTapGesture {
                guard !isFlying, abs(drag) < 4 else { return }
                onOpen(card)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Opens the card. Swipe left or right to browse.")
            .accessibilityIdentifier("deck.card")
            .accessibilityAction(named: "Next card") { advance(forward: true) }
            .accessibilityAction(named: "Previous card") { advance(forward: false) }
    }

    private var swipe: some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { value in
                guard !isFlying else { return }
                drag = value.translation.width
            }
            .onEnded { value in
                guard !isFlying else { return }
                let flick = value.predictedEndTranslation.width
                if value.translation.width < -threshold || flick < -threshold * 2.5 {
                    advance(forward: true, velocity: flick)
                } else if value.translation.width > threshold || flick > threshold * 2.5 {
                    advance(forward: false, velocity: flick)
                } else {
                    withAnimation(.spring(duration: 0.45, bounce: 0.35)) { drag = 0 }
                }
            }
    }

    /// Forward: the card sails off to the left and joins the back of the
    /// loop. Back: the previous card slides in from the left.
    private func advance(forward: Bool, velocity: CGFloat = 0) {
        guard !isFlying, session.cards.count > 1 else {
            withAnimation(.spring(duration: 0.45, bounce: 0.35)) { drag = 0 }
            return
        }
        direction = forward ? 1 : -1
        if forward {
            isFlying = true
            let distance: CGFloat = -(520 + min(abs(velocity) * 0.25, 300))
            withAnimation(.spring(duration: 0.35, bounce: 0)) { drag = distance }
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(200))
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) { drag = 0 }
                session.next()
                isFlying = false
            }
        } else {
            withAnimation(.spring(duration: 0.5, bounce: 0.22)) {
                drag = 0
                session.previous()
            }
        }
    }

    private var dots: some View {
        HStack(spacing: 6) {
            ForEach(Array(session.cards.prefix(9).enumerated()), id: \.element.id) { position, _ in
                Capsule()
                    .fill(position == session.index % 9 ? FLColor.textPrimary : FLColor.textTertiary.opacity(0.4))
                    .frame(width: position == session.index % 9 ? 16 : 6, height: 6)
            }
        }
        .flAnimation(.select, value: session.index)
        .accessibilityHidden(true)
    }

    // MARK: Summary

    private var summary: some View {
        VStack(alignment: .leading, spacing: FLSpacing.l) {
            Spacer(minLength: 0)
            DrawnCheckmark(size: 48)
            Text("You know all \(session.total).")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
            Text(session.practised.isEmpty
                 ? "Every card, first time. Parfait."
                 : "\(session.practised.count) took a little practice. That's how it sticks.")
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
            PrimaryButton("Done", systemImage: "checkmark") { onClose() }
                .accessibilityIdentifier("deck.done")
            Spacer(minLength: 0)
        }
        .accessibilityIdentifier("deck.summary")
    }
}

// MARK: - The card

extension Flashcard.Kind {
    /// Deep to bright, like Strava's workout cards.
    var palette: [Color] {
        switch self {
        case .word: [.hex(0x24124F), .hex(0x5B2BD9), .hex(0xA06CFF)]
        case .expression: [.hex(0x3A0D3F), .hex(0xA0278F), .hex(0xF26BB3)]
        case .verb: [.hex(0x052F38), .hex(0x0B8A86), .hex(0x52D6C4)]
        }
    }

    var symbol: String {
        switch self {
        case .word: "character.book.closed.fill"
        case .expression: "quote.bubble.fill"
        case .verb: "arrow.triangle.branch"
        }
    }
}

/// A glossy gradient card: meta at the top, the French big at the bottom.
struct FlashcardTile: View {
    let card: Flashcard

    var body: some View {
        ZStack(alignment: .topLeading) {
            FlashcardGloss(palette: card.kind.palette)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: FLSpacing.l) {
                    meta("Type", card.kind.label)
                    meta("Level", card.level.rawValue)
                    Spacer()
                    Image(systemName: card.kind.symbol)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.95))
                }
                Spacer(minLength: FLSpacing.s)
                Text(AttributedString.french(card.front))
                    .font(.system(size: 32, weight: .heavy))
                    .tracking(-0.6)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                    .accessibilityIdentifier("deck.front")
                Text(card.example ?? card.hint)
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(3)
                    .padding(.top, 6)
            }
            .padding(22)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.white.opacity(0.18), lineWidth: 1)
        )
        .shadow(color: card.kind.palette[1].opacity(0.45), radius: 22, x: 0, y: 14)
    }

    private func meta(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.7))
            Text(value)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
        }
    }
}

/// Deep gradient with soft diagonal light, the look of the Strava cards.
struct FlashcardGloss: View {
    let palette: [Color]

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height
            ZStack {
                LinearGradient(colors: palette, startPoint: .bottomLeading, endPoint: .topTrailing)
                // Two soft diagonal bands of light.
                Rectangle()
                    .fill(LinearGradient(colors: [.white.opacity(0), .white.opacity(0.22), .white.opacity(0)], startPoint: .leading, endPoint: .trailing))
                    .frame(width: w * 0.35, height: h * 2.4)
                    .rotationEffect(.degrees(28))
                    .offset(x: w * 0.18, y: -h * 0.1)
                    .blur(radius: 8)
                Rectangle()
                    .fill(LinearGradient(colors: [.white.opacity(0), .white.opacity(0.12), .white.opacity(0)], startPoint: .leading, endPoint: .trailing))
                    .frame(width: w * 0.2, height: h * 2.4)
                    .rotationEffect(.degrees(28))
                    .offset(x: w * 0.42, y: -h * 0.1)
                    .blur(radius: 6)
                // Light from the top edge.
                LinearGradient(colors: [.white.opacity(0.18), .clear], startPoint: .top, endPoint: .center)
            }
            .frame(width: w, height: h)
        }
    }
}
