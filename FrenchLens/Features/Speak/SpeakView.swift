import SwiftUI

/// Speak: choose a situation, then talk it through with Camille.
struct SpeakView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(LessonStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(AppSettings.self) private var settings

    private var lessonScenarios: [Lesson] {
        Array(store.recent.prefix(3))
    }

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.speakPath) {
            ScrollView {
                VStack(alignment: .leading, spacing: FLSpacing.l) {
                    VStack(alignment: .leading, spacing: FLSpacing.xs) {
                        Text("Speak")
                            .flTextStyle(.display)
                            .foregroundStyle(FLColor.textPrimary)
                            .accessibilityAddTraits(.isHeader)
                            .accessibilityIdentifier("speak.title")
                        Text("Talk with Camille, out loud or by typing. She replies in French at your level (\(settings.level.rawValue)) and gently fixes your mistakes.")
                            .flTextStyle(.body)
                            .foregroundStyle(FLColor.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, FLSpacing.xl)
                    .flAppear(0)

                    NavigationLink(value: PracticeScenario.freeChat.inVoice()) {
                        VoiceHeroCard()
                    }
                    .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
                    .accessibilityIdentifier("speak.voiceHero")
                    .flAppear(1)

                    VStack(alignment: .leading, spacing: FLSpacing.s) {
                        SectionHeader("Situations")
                        ForEach(Array(PracticeScenario.builtIn.enumerated()), id: \.element.id) { index, scenario in
                            NavigationLink(value: scenario) {
                                ScenarioRow(scenario: scenario)
                            }
                            .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
                            .accessibilityIdentifier("speak.scenario.\(scenario.id)")
                            .flAppear(index + 2)
                        }
                    }

                    if !lessonScenarios.isEmpty {
                        VStack(alignment: .leading, spacing: FLSpacing.s) {
                            SectionHeader("From your lessons")
                            ForEach(lessonScenarios) { lesson in
                                NavigationLink(value: PracticeScenario.about(lesson)) {
                                    ScenarioRow(scenario: PracticeScenario.about(lesson))
                                }
                                .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
                            }
                        }
                        .flAppear(PracticeScenario.builtIn.count + 2)
                    }
                }
                .padding(.horizontal, FLSpacing.gutter)
                .padding(.bottom, FLSpacing.xxl)
            }
            .scrollIndicators(.hidden)
            .flSoftTopEdge()
            .background(FLColor.background.ignoresSafeArea())
            .flTopBlur()
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: PracticeScenario.self) { scenario in
                ConversationView(scenario: scenario, engine: environment.makeTutor(for: scenario))
            }
        }
    }
}

/// "Talk with Camille": a live orb that opens a hands-free conversation.
private struct VoiceHeroCard: View {
    var body: some View {
        HStack(spacing: FLSpacing.m) {
            VoiceOrb(mood: .resting, level: 0, diameter: 64)
            VStack(alignment: .leading, spacing: 3) {
                Text("Talk with Camille")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(FLColor.textPrimary)
                Text("A hands-free voice conversation in French, like a phone call.")
                    .font(.footnote)
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "waveform")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(FLColor.textOnAccent)
                .frame(width: 36, height: 36)
                .background(Circle().fill(FLColor.accent))
        }
        .padding(FLSpacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flSurface(FLColor.surface, radius: FLRadius.large, elevation: .raised)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

private struct ScenarioRow: View {
    let scenario: PracticeScenario

    var body: some View {
        HStack(spacing: FLSpacing.m) {
            Image(systemName: scenario.systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(FLColor.accent)
                .frame(width: 40, height: 40)
                .background(Circle().fill(FLColor.accentSoft))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(scenario.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(FLColor.textPrimary)
                    .lineLimit(1)
                Text(scenario.subtitle)
                    .font(.footnote)
                    .foregroundStyle(FLColor.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(FLColor.textTertiary)
        }
        .padding(FLSpacing.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flSurface(FLColor.surface, radius: FLRadius.medium)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
