import SwiftUI

struct HomeView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(LessonStore.self) private var store
    @Environment(AppRouter.self) private var router
    @ScaledMetric(relativeTo: .largeTitle) private var greetingSize: CGFloat = 52
    @Namespace private var zoom
    @State private var scrollOffset: CGFloat = 0

    /// The compact bar takes over as "Bonjour." scrolls away.
    private var barProgress: Double { ScrollProgress(start: 70, end: 120)(scrollOffset) }

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.homePath) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    BrandMark()
                        .padding(.top, FLSpacing.xs)
                        .opacity(1 - barProgress)
                        .flAppear(0)
                        .flOnScrollOffsetChange { scrollOffset = $0 }

                    greeting
                        .padding(.top, FLSpacing.xxl)

                    PrimaryButton("Understand something", systemImage: "viewfinder") {
                        router.isShowingCaptureSheet = true
                    }
                    .accessibilityIdentifier("understandButton")
                    .padding(.top, FLSpacing.xl)
                    .flAppear(3)

                    Button {
                        router.isShowingListen = true
                    } label: {
                        HStack(spacing: FLSpacing.s) {
                            ListeningWaveform(isActive: false, barCount: 5, height: 18)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Listen while you watch")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(FLColor.textPrimary)
                                Text("Learn from a Reel as it plays in Instagram")
                                    .font(.footnote)
                                    .foregroundStyle(FLColor.textSecondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(FLColor.textTertiary)
                        }
                        .padding(.horizontal, FLSpacing.m)
                        .padding(.vertical, FLSpacing.s)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .flSurface(FLColor.surface, radius: FLRadius.medium)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(FLPressableStyle(scale: 0.98, highlights: false))
                    .accessibilityIdentifier("homeListen")
                    .padding(.top, FLSpacing.s)
                    .flAppear(4)

                    Text("Or share any French video to FrenchLens from TikTok, YouTube or Photos.")
                        .font(.footnote)
                        .foregroundStyle(FLColor.textTertiary)
                        .padding(.top, FLSpacing.s)
                        .flAppear(4)

                    recent
                        .padding(.top, FLSpacing.xxl)
                }
                .padding(.horizontal, FLSpacing.gutter)
                .padding(.bottom, FLSpacing.xxl)
            }
            .scrollIndicators(.hidden)
            .flSoftTopEdge()
            .background(FLColor.background.ignoresSafeArea())
            .flTopBlur()
            .overlay(alignment: .top) {
                CollapsingTopBar(title: "Bonjour.", progress: barProgress)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: LessonRoute.self) { route in
                lessonDestination(route)
            }
            .sheet(isPresented: $router.isShowingCaptureSheet, onDismiss: { router.captureSheetDidDismiss() }) {
                CaptureSheet()
            }
        }
    }

    @ViewBuilder
    private func lessonDestination(_ route: LessonRoute) -> some View {
        if route.zoomsFromThumbnail {
            LessonView(lessonID: route.id).flZoomDestination(id: route.id, in: zoom)
        } else {
            LessonView(lessonID: route.id)
        }
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xs) {
            Text("Bonjour.")
                .font(.system(size: greetingSize, weight: .bold))
                .tracking(-1.4)
                .foregroundStyle(FLColor.textPrimary)
                .accessibilityAddTraits(.isHeader)
                .flAppear(1, distance: 28)
            Text("What did you find today?")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textSecondary)
                .flAppear(2)
        }
        // Scroll-driven: the greeting recedes as it leaves.
        .opacity(1 - barProgress * 0.9)
        .scaleEffect(1 - barProgress * 0.04, anchor: .topLeading)
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader("Recent")
                .padding(.bottom, FLSpacing.xs)
                .flAppear(5)

            if store.recent.isEmpty {
                EmptyState(
                    symbol: "sparkles.rectangle.stack",
                    title: "No lessons yet.",
                    message: "Find something in French and share it with FrenchLens.",
                    actionTitle: "How it works",
                    action: { router.isShowingHowItWorks = true }
                )
                .accessibilityIdentifier("home.emptyState")
                .transition(.flReveal)
            } else {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(store.recent.prefix(12).enumerated()), id: \.element.id) { index, lesson in
                        NavigationLink(value: LessonRoute(id: lesson.id, zoomsFromThumbnail: true)) {
                            LessonRow(lesson: lesson, thumbnailURL: environment.thumbnailURL(for: lesson), zoomNamespace: zoom)
                        }
                        .buttonStyle(.flPressable)
                        .accessibilityIdentifier("lessonRow")
                        .contextMenu { contextMenu(for: lesson) }
                        .overlay(alignment: .bottom) { Hairline() }
                        .flScrollFocus()
                        .flAppear(6 + index)
                        .transition(.flReveal)
                    }
                }
            }
        }
        .flAnimation(.reveal, value: store.recent.map(\.id))
    }

    @ViewBuilder
    private func contextMenu(for lesson: Lesson) -> some View {
        Button {
            store.toggleSaved(lessonID: lesson.id)
        } label: {
            Label(lesson.isSaved ? "Remove from Library" : "Save to Library",
                  systemImage: lesson.isSaved ? "bookmark.slash" : "bookmark")
        }
        Button(role: .destructive) {
            store.delete(lessonID: lesson.id)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }
}
