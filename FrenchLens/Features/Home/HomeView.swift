import SwiftUI

struct HomeView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(LessonStore.self) private var store
    @Environment(AppRouter.self) private var router
    @ScaledMetric(relativeTo: .largeTitle) private var greetingSize: CGFloat = 52

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.homePath) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    BrandMark()
                        .padding(.top, FLSpacing.xs)

                    greeting
                        .padding(.top, FLSpacing.xxl)

                    PrimaryButton("Understand something", systemImage: "viewfinder") {
                        router.isShowingCaptureSheet = true
                    }
                    .accessibilityIdentifier("understandButton")
                    .padding(.top, FLSpacing.xl)

                    Text("Or share any French video to FrenchLens from Instagram, TikTok or YouTube.")
                        .font(.footnote)
                        .foregroundStyle(FLColor.textTertiary)
                        .padding(.top, FLSpacing.s)

                    recent
                        .padding(.top, FLSpacing.xxl)
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
            .sheet(isPresented: $router.isShowingCaptureSheet, onDismiss: { router.captureSheetDidDismiss() }) {
                CaptureSheet()
            }
        }
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xs) {
            Text("Bonjour.")
                .font(.system(size: greetingSize, weight: .bold))
                .tracking(-1.4)
                .foregroundStyle(FLColor.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Text("What did you find today?")
                .flTextStyle(.title)
                .foregroundStyle(FLColor.textSecondary)
        }
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 0) {
            recentContent
        }
    }

    @ViewBuilder
    private var recentContent: some View {
        SectionHeader("Recent")
            .padding(.bottom, FLSpacing.xs)

        if store.recent.isEmpty {
            EmptyState(
                symbol: "sparkles.rectangle.stack",
                title: "No lessons yet.",
                message: "Find something in French and share it with FrenchLens.",
                actionTitle: "How it works",
                action: { router.isShowingHowItWorks = true }
            )
            .accessibilityIdentifier("home.emptyState")
        } else {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(store.recent.prefix(12)) { lesson in
                    NavigationLink(value: LessonRoute(id: lesson.id)) {
                        LessonRow(lesson: lesson, thumbnailURL: environment.thumbnailURL(for: lesson))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("lessonRow")
                    .contextMenu {
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
                    Hairline()
                }
            }
        }
    }
}
