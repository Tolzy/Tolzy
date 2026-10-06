import SwiftUI

struct ReviewView: View {
    @Environment(LessonStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var session = ReviewSession()

    var body: some View {
        NavigationStack {
            ZStack {
                FLColor.background.ignoresSafeArea()
                content
                    .padding(.horizontal, FLSpacing.gutter)
                    .animation(FLMotion.resolve(FLMotion.spring, reduceMotion: reduceMotion), value: session.phase)
                    .animation(FLMotion.resolve(FLMotion.spring, reduceMotion: reduceMotion), value: session.index)
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch session.phase {
        case .intro: intro
        case .question, .answered: question
        case .finished: finished
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
                    let count = ReviewExerciseGenerator().exercises(from: store.saved).count
                    Text("\(count) cards from \(store.saved.count) saved \(store.saved.count == 1 ? "lesson" : "lessons"). About two minutes.")
                        .flTextStyle(.body)
                        .foregroundStyle(FLColor.textSecondary)

                    VStack(alignment: .leading, spacing: FLSpacing.s) {
                        ReviewKindLine(symbol: "text.bubble", text: "What words and expressions mean")
                        ReviewKindLine(symbol: "arrow.uturn.backward", text: "Which infinitive a form comes from")
                        ReviewKindLine(symbol: "square.and.pencil", text: "The missing verb in a sentence")
                    }
                    .padding(.vertical, FLSpacing.s)

                    PrimaryButton("Start review", systemImage: "play.fill") {
                        session.start(from: store.saved)
                    }
                    .accessibilityIdentifier("review.start")
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    // MARK: Question

    @ViewBuilder
    private var question: some View {
        if let exercise = session.current {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("\(session.index + 1) of \(session.exercises.count)")
                        .flTextStyle(.mono)
                        .foregroundStyle(FLColor.textTertiary)
                    Spacer()
                    Button("End") { session.reset() }
                        .font(.body.weight(.medium))
                        .foregroundStyle(FLColor.textSecondary)
                }
                .padding(.top, FLSpacing.m)

                ProgressLine(progress: session.progress)
                    .padding(.top, FLSpacing.s)

                Spacer(minLength: FLSpacing.l)

                Text(exercise.prompt)
                    .flTextStyle(.label)
                    .foregroundStyle(FLColor.textTertiary)
                FrenchText(exercise.focus, style: .display)
                    .padding(.top, FLSpacing.xs)
                    .accessibilityIdentifier("review.focus")

                Spacer(minLength: FLSpacing.l)

                VStack(spacing: FLSpacing.xs) {
                    ForEach(exercise.options, id: \.self) { option in
                        OptionRow(
                            text: option,
                            state: optionState(option, in: exercise),
                            isFrench: exercise.kind != .meaning
                        ) {
                            session.choose(option)
                        }
                    }
                }

                if case .answered(let correct) = session.phase {
                    VStack(alignment: .leading, spacing: FLSpacing.s) {
                        if let explanation = exercise.explanation {
                            Text(explanation)
                                .flTextStyle(.bodySmall)
                                .foregroundStyle(FLColor.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        PrimaryButton(session.index + 1 < session.exercises.count ? "Continue" : "Finish") {
                            session.advance()
                        }
                        .accessibilityIdentifier("review.continue")
                    }
                    .padding(.top, FLSpacing.m)
                    .transition(AnyTransition.opacity.combined(with: .move(edge: .bottom)))
                    .accessibilityLabel(correct ? "Correct" : "Not quite")
                }

                Spacer(minLength: FLSpacing.l)
            }
            .id(exercise.id)
            .transition(AnyTransition.asymmetric(insertion: AnyTransition.move(edge: .trailing).combined(with: .opacity), removal: .opacity))
            .sensoryFeedback(trigger: session.phase) { _, newPhase -> SensoryFeedback? in
                guard case .answered(let correct) = newPhase else { return nil }
                return correct ? SensoryFeedback.success : SensoryFeedback.error
            }
        }
    }

    private func optionState(_ option: String, in exercise: ReviewExercise) -> OptionRow.Status {
        guard case .answered = session.phase else { return .idle }
        if option == exercise.answer { return .correct }
        if option == session.selectedOption { return .wrong }
        return .dimmed
    }

    // MARK: Finished

    private var finished: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            Spacer()
            Text(session.correctCount == session.exercises.count ? "Parfait." : "Bien joué.")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
            Text("\(session.correctCount) of \(session.exercises.count) correct.")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textSecondary)
            Spacer()
            PrimaryButton("Review again", systemImage: "arrow.clockwise") {
                session.start(from: store.saved)
            }
            SecondaryButton("Done") { session.reset() }
                .padding(.bottom, FLSpacing.l)
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
    let state: Status
    let isFrench: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(isFrench ? AttributedString.french(text) : AttributedString(text))
                    .font(.body.weight(.medium))
                    .foregroundStyle(state == .dimmed ? FLColor.textTertiary : FLColor.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer()
                switch state {
                case .correct:
                    Image(systemName: "checkmark").foregroundStyle(FLColor.success)
                case .wrong:
                    Image(systemName: "xmark").foregroundStyle(FLColor.error)
                default:
                    EmptyView()
                }
            }
            .font(.body.weight(.semibold))
            .padding(.horizontal, FLSpacing.m)
            .frame(minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .fill(state == .correct ? FLColor.success.opacity(0.12) : FLColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .strokeBorder(border, lineWidth: state == .idle || state == .dimmed ? 0.5 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(state != .idle)
        .accessibilityValue(state == .correct ? "Correct answer" : state == .wrong ? "Your answer, incorrect" : "")
        .accessibilityIdentifier("review.option")
    }

    private var border: Color {
        switch state {
        case .correct: FLColor.success
        case .wrong: FLColor.error
        default: FLColor.separator
        }
    }
}
