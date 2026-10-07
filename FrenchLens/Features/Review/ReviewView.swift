import SwiftUI

/// Review, choreographed as a short, calm sequence of cards:
/// cards slide forward, options arrive in order, a right answer pops and a
/// wrong one shakes (each with its haptic), the explanation rises in, and
/// the score counts up at the end. No streaks, points or lives.
struct ReviewView: View {
    @Environment(LessonStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(MilestoneStore.self) private var milestones
    @Environment(\.motion) private var motion
    @Environment(AppSettings.self) private var settings
    @State private var session = ReviewSession()
    @State private var deck: FlashcardSession?
    /// The open card, pushed so it zooms out of the deck.
    @State private var openCards: [String] = []
    @Namespace private var cardZoom

    var body: some View {
        NavigationStack(path: $openCards) {
            ZStack {
                FLColor.background.ignoresSafeArea()
                ZStack {
                    if let deck {
                        FlashcardDeckView(
                            session: deck,
                            zoom: cardZoom,
                            onOpen: { card in openCards.append(card.id) },
                            onFinish: { firstTime, total in
                                milestones.record(.reviewFinished(correct: firstTime, total: total))
                            },
                            onClose: { motion.perform(.reveal) { self.deck = nil } }
                        )
                        .transition(.flReveal)
                    } else {
                    switch session.phase {
                    case .intro:
                        intro.transition(.flReveal)
                    case .question, .answered:
                        question
                    case .finished:
                        finished.transition(.flReveal)
                    }
                    }
                }
                .padding(.horizontal, FLSpacing.gutter)
            }
            .flTopBlur()
            .toolbar(.hidden, for: .navigationBar)
            .toolbar(deck == nil ? Visibility.automatic : Visibility.hidden, for: .tabBar)
            .navigationDestination(for: String.self) { id in
                if let deck, let card = deck.card(id: id) {
                    FlashcardDetailView(
                        card: card,
                        onKnown: { close(card) { deck.markKnown(card.id) } },
                        onPractise: { close(card) { deck.keepPractising(card.id) } }
                    )
                    .flZoomDestination(id: id, in: cardZoom)
                }
            }
        }
        .onChange(of: session.phase) { _, phase in
            if phase == .finished {
                milestones.record(.reviewFinished(correct: session.correctCount, total: session.exercises.count))
            }
        }
        .flHaptic(trigger: session.phase) { _, new in
            guard case .answered(let correct) = new else { return nil }
            return correct ? FLHaptic.success : FLHaptic.failure
        }
    }

    /// Zoom the card back into the deck, then update the deck.
    private func close(_ card: Flashcard, then update: @escaping () -> Void) {
        openCards.removeAll()
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(motion.allowsMovement ? 420 : 50))
            motion.perform(.reveal) { update() }
        }
    }

    // MARK: Intro

    private var intro: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FLSpacing.l) {
                Text("Review your French")
                    .flTextStyle(.display)
                    .foregroundStyle(FLColor.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("review.title")
                    .padding(.top, FLSpacing.xl)
                    .flAppear(0)

                if store.saved.isEmpty {
                    EmptyState(
                        symbol: "rectangle.on.rectangle",
                        title: "Nothing to review yet.",
                        message: "Save a lesson and FrenchLens will turn its words, verbs and expressions into short reviews.",
                        actionTitle: "Find a lesson",
                        action: { router.selectedTab = .home }
                    )
                    .accessibilityIdentifier("review.emptyState")
                } else {
                    let count = FlashcardBuilder.cards(from: store.saved, level: settings.level).count
                    Text("\(count) cards from \(store.saved.count) saved \(store.saved.count == 1 ? "lesson" : "lessons"). About two minutes.")
                        .flTextStyle(.body)
                        .foregroundStyle(FLColor.textSecondary)
                        .flAppear(1)

                    VStack(alignment: .leading, spacing: FLSpacing.s) {
                        ReviewKindLine(symbol: "hand.draw", text: "Swipe right if you know it, left to keep learning")
                            .flAppear(2)
                        ReviewKindLine(symbol: "hand.tap", text: "Tap a card for its meaning, examples and conjugation")
                            .flAppear(3)
                        ReviewKindLine(symbol: "speaker.wave.2", text: "Hear every word, slowly")
                            .flAppear(4)
                    }
                    .padding(.vertical, FLSpacing.s)

                    PrimaryButton("Start review", systemImage: "rectangle.stack.fill") {
                        let cards = FlashcardBuilder.cards(from: store.saved, level: settings.level, seed: UInt64(Date().timeIntervalSince1970))
                        let newDeck = FlashcardSession()
                        newDeck.start(with: cards)
                        motion.perform(.reveal) { deck = newDeck }
                    }
                    .accessibilityIdentifier("review.start")
                    .flAppear(5)

                    SecondaryButton("Quick quiz instead", systemImage: "checklist") {
                        motion.perform(.reveal) { session.start(from: store.saved) }
                    }
                    .accessibilityIdentifier("review.quiz")
                    .flAppear(6)
                }
            }
        }
        .scrollIndicators(.hidden)
        .flSoftTopEdge()
    }

    // MARK: Question

    private var question: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("\(session.index + 1) of \(session.exercises.count)")
                    .flTextStyle(.mono)
                    .foregroundStyle(FLColor.textTertiary)
                    .contentTransition(.numericText(value: Double(session.index)))
                Spacer()
                Button("End") {
                    motion.perform(.reveal) { session.reset() }
                }
                .font(.body.weight(.medium))
                .foregroundStyle(FLColor.textSecondary)
            }
            .padding(.top, FLSpacing.m)

            ProgressLine(progress: session.progress)
                .padding(.top, FLSpacing.s)

            ZStack(alignment: .topLeading) {
                if let exercise = session.current {
                    QuestionCard(
                        exercise: exercise,
                        phase: session.phase,
                        selectedOption: session.selectedOption,
                        isLast: session.index + 1 >= session.exercises.count,
                        onChoose: { option in motion.perform(.emphasis) { session.choose(option) } },
                        onContinue: { motion.perform(.reveal) { session.advance() } }
                    )
                    .id(exercise.id)
                    .transition(.flSlide(direction: 1, distance: 60))
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    // MARK: Finished

    private var finished: some View {
        FinishedView(
            correct: session.correctCount,
            total: session.exercises.count,
            onAgain: { motion.perform(.reveal) { session.start(from: store.saved) } },
            onDone: { motion.perform(.reveal) { session.reset() } }
        )
    }
}

/// One question. A new identity per exercise, so its entrance replays.
private struct QuestionCard: View {
    let exercise: ReviewExercise
    let phase: ReviewSession.Phase
    let selectedOption: String?
    let isLast: Bool
    let onChoose: (String) -> Void
    let onContinue: () -> Void

    private var isAnswered: Bool {
        if case .answered = phase { return true }
        return false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: FLSpacing.l)

            Text(exercise.prompt)
                .flTextStyle(.label)
                .foregroundStyle(FLColor.textTertiary)
                .flAppear(0)
            FrenchText(exercise.focus, style: .display)
                .padding(.top, FLSpacing.xs)
                .accessibilityIdentifier("review.focus")
                .flAppear(1, distance: 24)

            Spacer(minLength: FLSpacing.l)

            VStack(spacing: FLSpacing.xs) {
                ForEach(Array(exercise.options.enumerated()), id: \.element) { index, option in
                    OptionRow(
                        text: option,
                        status: status(of: option),
                        isFrench: exercise.kind != .meaning,
                        answerTrigger: phase
                    ) {
                        onChoose(option)
                    }
                    .flAppear(index + 2)
                }
            }

            if isAnswered {
                VStack(alignment: .leading, spacing: FLSpacing.s) {
                    if let explanation = exercise.explanation {
                        Text(explanation)
                            .flTextStyle(.bodySmall)
                            .foregroundStyle(FLColor.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    PrimaryButton(isLast ? "Finish" : "Continue", action: onContinue)
                        .accessibilityIdentifier("review.continue")
                }
                .padding(.top, FLSpacing.m)
                .transition(.flReveal)
            }

            Spacer(minLength: FLSpacing.l)
        }
    }

    private func status(of option: String) -> OptionRow.Status {
        guard isAnswered else { return .idle }
        if option == exercise.answer { return .correct }
        if option == selectedOption { return .wrong }
        return .dimmed
    }
}

private struct FinishedView: View {
    let correct: Int
    let total: Int
    let onAgain: () -> Void
    let onDone: () -> Void

    @Environment(\.motion) private var motion
    @State private var shown = 0

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            Spacer()
            if correct == total {
                DrawnCheckmark(size: 48)
                    .padding(.bottom, FLSpacing.s)
            }
            Text(correct == total ? "Parfait." : "Bien joué.")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .flAppear(0, distance: 24)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(shown)")
                    .contentTransition(.numericText(value: Double(shown)))
                Text("of \(total) correct.")
            }
            .flTextStyle(.title)
            .foregroundStyle(FLColor.textSecondary)
            .flAppear(1)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(correct) of \(total) correct")
            Spacer()
            PrimaryButton("Review again", systemImage: "arrow.clockwise", action: onAgain)
                .flAppear(2)
            SecondaryButton("Done", action: onDone)
                .padding(.bottom, FLSpacing.l)
                .flAppear(3)
        }
        .task {
            // Count up to the score, one beat per point.
            guard motion.allowsMovement else {
                shown = correct
                return
            }
            for value in 0...max(correct, 0) {
                try? await Task.sleep(for: .milliseconds(value == 0 ? 350 : 90))
                motion.perform(.swap) { shown = value }
            }
        }
    }
}

private struct ReviewKindLine: View {
    let symbol: String
    let text: String

    var body: some View {
        HStack(spacing: FLSpacing.s) {
            Image(systemName: symbol)
                .frame(width: 24)
                .foregroundStyle(FLColor.textTertiary)
            Text(text)
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textPrimary)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct OptionRow: View {
    enum Status { case idle, correct, wrong, dimmed }

    let text: String
    let status: Status
    let isFrench: Bool
    /// Changes when the question is answered, firing pop / shake.
    let answerTrigger: ReviewSession.Phase
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(isFrench ? AttributedString.french(text) : AttributedString(text))
                    .font(.body.weight(.medium))
                    .foregroundStyle(status == .dimmed ? FLColor.textTertiary : FLColor.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer()
                ZStack {
                    switch status {
                    case .correct:
                        Image(systemName: "checkmark").foregroundStyle(FLColor.success).transition(.flSwap)
                    case .wrong:
                        Image(systemName: "xmark").foregroundStyle(FLColor.error).transition(.flSwap)
                    default:
                        EmptyView()
                    }
                }
            }
            .font(.body.weight(.semibold))
            .padding(.horizontal, FLSpacing.m)
            .frame(minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .fill(status == .correct ? FLColor.success.opacity(0.12) : FLColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .strokeBorder(border, lineWidth: status == .idle || status == .dimmed ? 0.5 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
        .disabled(status != .idle)
        .flPop(trigger: status == .correct ? answerTrigger : .question)
        .flShake(trigger: status == .wrong ? answerTrigger : .question)
        .flAnimation(.swap, value: status)
        .accessibilityValue(status == .correct ? "Correct answer" : status == .wrong ? "Your answer, incorrect" : "")
        .accessibilityIdentifier("review.option")
    }

    private var border: Color {
        switch status {
        case .correct: FLColor.success
        case .wrong: FLColor.error
        default: FLColor.separator
        }
    }
}
