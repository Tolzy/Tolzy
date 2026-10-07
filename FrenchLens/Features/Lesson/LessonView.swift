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
///
/// Motion choreography (all via the motion system, all Reduce-Motion aware):
/// - Entrance: header, transcript sentences and sections assemble in order.
/// - Scroll: the hero stretches/parallaxes; a compact title fades into the
///   navigation bar in lockstep with the finger once the header scrolls away.
/// - Sections slide in from the direction of travel.
/// - Words open a floating panel; the highlight travels between words.
/// - Saving pops the bookmark, plays a haptic and confirms with a toast.
struct LessonDetailView: View {
    let lesson: Lesson

    @Environment(AppEnvironment.self) private var environment
    @Environment(LessonStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(AppRouter.self) private var router
    @Environment(\.tts) private var tts
    @Environment(\.motion) private var motion

    @State private var selection: TokenSelection?
    @State private var section: LessonSection = .vocabulary
    @State private var sectionDirection: Double = 1
    @State private var playback: PlaybackController?
    @State private var scrollOffset: CGFloat = 0
    @State private var toast: String?

    private let heroHeight: CGFloat = 440

    private var analysis: LessonAnalysis { lesson.analysis }
    private var level: CEFRLevel { settings.level }
    private var sections: [LessonSection] { LessonSection.available(in: analysis) }

    /// 0 → 1 as the header scrolls under the navigation bar.
    private var titleProgress: Double {
        ScrollProgress(start: heroHeight - 160, end: heroHeight - 60)(scrollOffset)
    }

    /// Demo Mode answered the learner's own video or text with a sample.
    private var isSampleAnalysisOfLearnerContent: Bool {
        lesson.origin == .demo && (lesson.source.mediaFileName != nil || lesson.source.kind == .text || lesson.source.kind == .listened)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VideoHero(lesson: lesson, playback: playback, height: heroHeight, posterImageURL: environment.thumbnailURL(for: lesson))
                    .flOnScrollOffsetChange { scrollOffset = $0 }

                VStack(alignment: .leading, spacing: FLSpacing.xxl) {
                    LessonHeader(lesson: lesson)
                        .padding(.top, -FLSpacing.xxl)
                        .flAppear(0, distance: 24)

                    if isSampleAnalysisOfLearnerContent {
                        DemoBanner()
                            .flAppear(1)
                    }

                    VStack(alignment: .leading, spacing: FLSpacing.l) {
                        SectionHeader("What they said")
                            .flAppear(1)
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
                    .flAppear(analysis.transcript.segments.count + 1)
                    .flScrollFocus(strength: 0.5)

                    if !sections.isEmpty {
                        VStack(alignment: .leading, spacing: FLSpacing.m) {
                            SectionHeader("What you can learn")
                            SegmentBar(items: sections, selection: sectionBinding, title: \.title)
                            ZStack(alignment: .topLeading) {
                                sectionContent
                                    .id(section)
                                    .transition(.flSlide(direction: sectionDirection))
                            }
                        }
                        .flAppear(analysis.transcript.segments.count + 2)
                    }

                    PracticeLessonButton {
                        tts.stop()
                        playback?.pause()
                        router.practice(lesson)
                    }
                    .flAppear(analysis.transcript.segments.count + 3)
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
        .flToast($toast, systemImage: "bookmark.fill")
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(analysis.title)
                    .font(.headline)
                    .foregroundStyle(FLColor.textPrimary)
                    .opacity(titleProgress)
                    .offset(y: (1 - titleProgress) * 6)
                    .accessibilityHidden(titleProgress < 0.5)
            }
            ToolbarItem(placement: .topBarTrailing) { saveButton }
        }
        .toolbarBackground(titleProgress >= 1 ? .visible : .hidden, for: .navigationBar)
        .flAnimation(.swap, value: titleProgress >= 1)
        .toolbar(.hidden, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .flHaptic(trigger: lesson.isSaved) { _, isSaved in isSaved ? FLHaptic.saved : FLHaptic.unsaved }
        .flHaptic(.surface, trigger: selection == nil)
        .onAppear {
            if !sections.contains(section), let first = sections.first { section = first }
        }
        .task(id: lesson.id) {
            if playback == nil, let url = environment.mediaURL(for: lesson), FileManager.default.fileExists(atPath: url.path) {
                motion.perform(.reveal) { playback = PlaybackController(url: url) }
            }
        }
        .onDisappear {
            tts.stop()
            playback?.pause()
        }
    }

    /// Records the direction of travel in the same transaction as the change,
    /// so the incoming section slides in from the side the learner moved to.
    private var sectionBinding: Binding<LessonSection> {
        Binding(
            get: { section },
            set: { newValue in
                let old = sections.firstIndex(of: section) ?? 0
                let new = sections.firstIndex(of: newValue) ?? 0
                sectionDirection = new >= old ? 1 : -1
                section = newValue
            }
        )
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
            .transition(.flPanel)
        }
    }

    private var saveButton: some View {
        Button {
            let willSave = !lesson.isSaved
            motion.perform(.emphasis) { store.toggleSaved(lessonID: lesson.id) }
            toast = willSave ? "Saved to Library" : nil
        } label: {
            Image(systemName: lesson.isSaved ? "bookmark.fill" : "bookmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(lesson.isSaved ? FLColor.accent : FLColor.textPrimary)
                .contentTransition(.symbolEffect(.replace))
                .flPop(trigger: lesson.isSaved, tilt: -8)
                .frame(width: 36, height: 36)
                .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
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
                    .flScrollFocus()
                }
            }
        case .verbs:
            VStack(alignment: .leading, spacing: FLSpacing.m) {
                ForEach(analysis.verbs) { verb in
                    VerbCard(verb: verb, level: level, speakingID: tts.current?.utteranceID) { text, id in
                        speak(text, id: id, rate: .normal)
                    }
                    .flScrollFocus()
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
                    .flScrollFocus()
                }
            }
        case .grammar:
            VStack(alignment: .leading, spacing: 0) {
                ForEach(analysis.grammar) { point in
                    GrammarSection(point: point, level: level, speakingID: tts.current?.utteranceID) { text, id in
                        speak(text, id: id, rate: .normal)
                    }
                    .flScrollFocus()
                }
            }
        case .pronunciation:
            VStack(alignment: .leading, spacing: 0) {
                ForEach(analysis.pronunciation) { note in
                    PronunciationRow(note: note, level: level, playback: tts.current) { rate in
                        speak(note.phrase, id: "pronunciation.\(note.id)", rate: rate)
                    }
                    .flScrollFocus()
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
        motion.perform(.panel) { selection = nil }
    }
}

/// Leads from studying a video to talking about it.
private struct PracticeLessonButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FLSpacing.m) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(FLColor.accent)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(FLColor.accentSoft))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Practise speaking about this")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(FLColor.textPrimary)
                    Text("Chat out loud with Camille, using these words")
                        .font(.footnote)
                        .foregroundStyle(FLColor.textSecondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FLColor.textTertiary)
            }
            .padding(FLSpacing.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .flSurface(FLColor.surface, radius: FLRadius.large)
            .contentShape(Rectangle())
        }
        .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("lesson.practiceSpeaking")
    }
}
