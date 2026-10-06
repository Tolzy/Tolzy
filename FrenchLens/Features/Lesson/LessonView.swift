import SwiftUI

/// Resolves a lesson by id so the screen always reflects the store.
struct LessonView: View {
    let lessonID: UUID
    @Environment(LessonStore.self) private var store

    var body: some View {
        if let lesson = store.lesson(id: lessonID) {
            LessonDetailView(lesson: lesson)
        } else {
            EmptyState(
                symbol: "questionmark.folder",
                title: "This lesson is gone.",
                message: "It may have been deleted from your library."
            )
            .padding(FLSpacing.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(FLColor.background.ignoresSafeArea())
        }
    }
}

/// The cinematic lesson: hero → what they said → meaning → learning layers.
struct LessonDetailView: View {
    let lesson: Lesson

    @Environment(AppEnvironment.self) private var environment
    @Environment(LessonStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(\.tts) private var tts
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var selection: TokenSelection?
    @State private var section: LessonSection = .vocabulary
    @State private var playback: PlaybackController?
    @State private var saveCount = 0

    private var analysis: LessonAnalysis { lesson.analysis }
    private var level: CEFRLevel { settings.level }
    private var sections: [LessonSection] { LessonSection.available(in: analysis) }

    /// Demo Mode answered the learner's own video or text with a sample.
    private var isSampleAnalysisOfLearnerContent: Bool {
        lesson.origin == .demo && (lesson.source.mediaFileName != nil || lesson.source.kind == .text)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VideoHero(lesson: lesson, playback: playback)

                VStack(alignment: .leading, spacing: FLSpacing.xxl) {
                    LessonHeader(lesson: lesson)
                        .padding(.top, -FLSpacing.xxl)

                    if isSampleAnalysisOfLearnerContent {
                        DemoBanner()
                    }

                    VStack(alignment: .leading, spacing: FLSpacing.l) {
                        SectionHeader("What they said")
                        TranscriptView(
                            segments: analysis.transcript.segments,
                            analysis: analysis,
                            activeSegmentID: activeSegmentID,
                            spokenTokenIndex: spokenTokenIndex,
                            selection: $selection,
                            playback: tts.current,
                            onPlay: { segment, rate in speak(segment.text, id: LessonSpeech.segmentID(segment), rate: rate) }
                        )
                    }

                    VStack(alignment: .leading, spacing: FLSpacing.m) {
                        SectionHeader("Meaning")
                        TranslationBlock(translation: analysis.translation)
                    }

                    if !sections.isEmpty {
                        VStack(alignment: .leading, spacing: FLSpacing.m) {
                            SectionHeader("What you can learn")
                            SegmentBar(items: sections, selection: $section, title: \.title)
                            sectionContent
                                .id(section)
                                .transition(.opacity)
                        }
                    }
                }
                .padding(.horizontal, FLSpacing.gutter)
                // Room for the word panel so the last line is never covered.
                .padding(.bottom, selection == nil ? FLSpacing.xxxl : 340)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(FLColor.background.ignoresSafeArea())
        .overlay(alignment: .bottom) { wordPanel }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { saveButton }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: selection?.id)
        .sensoryFeedback(.success, trigger: saveCount)
        .onAppear {
            if !sections.contains(section), let first = sections.first { section = first }
        }
        .task(id: lesson.id) {
            if playback == nil, let url = environment.mediaURL(for: lesson), FileManager.default.fileExists(atPath: url.path) {
                playback = PlaybackController(url: url)
            }
        }
        .onDisappear {
            tts.stop()
            playback?.pause()
        }
    }

    // MARK: Pieces

    @ViewBuilder
    private var wordPanel: some View {
        if let selection {
            WordPopover(
                selection: selection,
                level: level,
                isSpeaking: tts.isSpeaking(LessonSpeech.wordID(selection.gloss)),
                onSpeak: { speak(selection.gloss.lemma, id: LessonSpeech.wordID(selection.gloss), rate: .slow) },
                onClose: { closeWordPanel() }
            )
            .padding(.bottom, FLSpacing.xs)
            .transition(reduceMotion ? AnyTransition.opacity : AnyTransition.move(edge: .bottom).combined(with: .opacity))
            .id(selection.id)
        }
    }

    private var saveButton: some View {
        Button {
            store.toggleSaved(lessonID: lesson.id)
            saveCount += 1
        } label: {
            Image(systemName: lesson.isSaved ? "bookmark.fill" : "bookmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(lesson.isSaved ? FLColor.accent : FLColor.textPrimary)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 36, height: 36)
                .background(.ultraThinMaterial, in: Circle())
        }
        .accessibilityLabel(lesson.isSaved ? "Saved to Library" : "Save lesson")
        .accessibilityIdentifier("saveLessonButton")
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .vocabulary:
            VStack(alignment: .leading, spacing: 0) {
                ForEach(analysis.vocabulary) { item in
                    let id = LessonSpeech.vocabularyID(item)
                    VocabularyRow(item: item, isSpeaking: tts.isSpeaking(id)) {
                        speak(item.french, id: id, rate: .normal)
                    }
                }
            }
        case .verbs:
            VStack(alignment: .leading, spacing: FLSpacing.m) {
                ForEach(analysis.verbs) { verb in
                    VerbCard(verb: verb, level: level, speakingID: tts.current?.utteranceID) { text, id in
                        speak(text, id: id, rate: .normal)
                    }
                }
            }
            .padding(.top, FLSpacing.xs)
        case .expressions:
            VStack(alignment: .leading, spacing: 0) {
                ForEach(analysis.expressions) { expression in
                    let id = LessonSpeech.expressionID(expression)
                    ExpressionCard(expression: expression, level: level, isSpeaking: tts.isSpeaking(id)) {
                        speak(expression.phrase, id: id, rate: .normal)
                    }
                }
            }
        case .grammar:
            VStack(alignment: .leading, spacing: 0) {
                ForEach(analysis.grammar) { point in
                    GrammarSection(point: point, level: level, speakingID: tts.current?.utteranceID) { text, id in
                        speak(text, id: id, rate: .normal)
                    }
                }
            }
        case .pronunciation:
            VStack(alignment: .leading, spacing: 0) {
                ForEach(analysis.pronunciation) { note in
                    PronunciationRow(note: note, level: level, playback: tts.current) { rate in
                        speak(note.phrase, id: "pronunciation.\(note.id)", rate: rate)
                    }
                }
            }
        }
    }

    // MARK: Sync

    /// The sentence being heard: TTS takes precedence over the video clock.
    private var activeSegmentID: String? {
        if let current = tts.current,
           let segment = analysis.transcript.segments.first(where: { LessonSpeech.segmentID($0) == current.utteranceID }) {
            return segment.id
        }
        if let playback, playback.isPlaying {
            return analysis.transcript.segment(at: playback.currentTime)?.id
        }
        return nil
    }

    private var spokenTokenIndex: Int? {
        guard let current = tts.current, let range = current.range,
              let segment = analysis.transcript.segments.first(where: { LessonSpeech.segmentID($0) == current.utteranceID })
        else { return nil }
        return segment.tokenIndex(atUTF16Offset: range.location)
    }

    // MARK: Actions

    private func speak(_ text: String, id: String, rate: SpeechRate) {
        playback?.pause()
        if tts.current?.utteranceID == id && tts.current?.rate == rate {
            tts.stop()
        } else {
            tts.speak(text, id: id, rate: rate)
        }
    }

    private func closeWordPanel() {
        withAnimation(FLMotion.resolve(FLMotion.spring, reduceMotion: reduceMotion)) {
            selection = nil
        }
    }
}
