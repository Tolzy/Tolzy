import SwiftUI

enum LibraryFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case vocabulary = "Vocabulary"
    case verbs = "Verbs"
    case expressions = "Expressions"

    var id: String { rawValue }
}

struct LibraryView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(LessonStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(AppRouter.self) private var router
    @Environment(\.tts) private var tts

    @State private var filter: LibraryFilter = .all

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.libraryPath) {
            ScrollView {
                VStack(alignment: .leading, spacing: FLSpacing.l) {
                    Text("Library")
                        .flTextStyle(.display)
                        .foregroundStyle(FLColor.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                        .padding(.top, FLSpacing.xl)

                    Picker("Filter", selection: $filter) {
                        ForEach(LibraryFilter.allCases) { filter in
                            Text(filter.rawValue).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("libraryFilter")

                    content
                        .animation(FLMotion.gentle, value: filter)
                }
                .padding(.horizontal, FLSpacing.gutter)
                .padding(.bottom, FLSpacing.xxl)
            }
            .scrollIndicators(.hidden)
            .background(FLColor.background.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: LessonRoute.self) { route in
                LessonView(lessonID: route.id)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.saved.isEmpty {
            EmptyState(
                symbol: "bookmark",
                title: "Nothing saved yet.",
                message: "Tap the bookmark on any lesson. Its words, verbs and expressions will collect here.",
                actionTitle: "Go to your lessons",
                action: { router.selectedTab = .home }
            )
            .accessibilityIdentifier("library.emptyState")
        } else {
            switch filter {
            case .all: savedLessons
            case .vocabulary: vocabulary
            case .verbs: verbs
            case .expressions: expressions
            }
        }
    }

    private var savedLessons: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader("Saved lessons", trailing: "\(store.saved.count)")
                .padding(.bottom, FLSpacing.xs)
            ForEach(store.saved) { lesson in
                NavigationLink(value: LessonRoute(id: lesson.id)) {
                    LessonRow(lesson: lesson, thumbnailURL: environment.thumbnailURL(for: lesson))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("savedLessonRow")
                .contextMenu {
                    Button(role: .destructive) {
                        store.setSaved(false, lessonID: lesson.id)
                    } label: {
                        Label("Remove from Library", systemImage: "bookmark.slash")
                    }
                }
                Hairline()
            }
        }
    }

    private var vocabulary: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader("Words", trailing: "\(store.savedVocabulary.count)")
            ForEach(store.savedVocabulary) { entry in
                let id = "library.\(LessonSpeech.vocabularyID(entry.item))"
                VocabularyRow(item: entry.item, isSpeaking: tts.isSpeaking(id)) {
                    tts.speak(entry.item.french, id: id, rate: .normal)
                }
            }
        }
    }

    private var verbs: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            SectionHeader("Verbs", trailing: "\(store.savedVerbs.count)")
            ForEach(store.savedVerbs) { entry in
                NavigationLink(value: LessonRoute(id: entry.lessonID)) {
                    VerbCard(verb: entry.item, level: settings.level, isCompact: true)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var expressions: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader("Expressions", trailing: "\(store.savedExpressions.count)")
            ForEach(store.savedExpressions) { entry in
                let id = "library.\(LessonSpeech.expressionID(entry.item))"
                ExpressionCard(expression: entry.item, level: settings.level, isSpeaking: tts.isSpeaking(id)) {
                    tts.speak(entry.item.phrase, id: id, rate: .normal)
                }
            }
        }
    }
}
