import SwiftUI

/// "Understand something": every way in, ordered by reliability.
struct CaptureSheet: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(IngestCoordinator.self) private var ingest
    @Environment(AppRouter.self) private var router

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FLSpacing.l) {
                VStack(alignment: .leading, spacing: FLSpacing.xs) {
                    Text("Understand something")
                        .flTextStyle(.title)
                        .foregroundStyle(FLColor.textPrimary)
                    Text("Bring in French from anywhere.")
                        .flTextStyle(.body)
                        .foregroundStyle(FLColor.textSecondary)
                }
                .padding(.top, FLSpacing.l)
                .flAppear(0)

                VStack(spacing: 0) {
                    Button {
                        let router = self.router
                        router.dismissCaptureSheet { router.isShowingListen = true }
                    } label: {
                        CaptureOption(
                            symbol: "waveform",
                            title: "Listen while you watch",
                            subtitle: "Play a Reel in Instagram. FrenchLens hears it. Best for Reels."
                        )
                    }
                    .buttonStyle(.flPressable)
                    .accessibilityIdentifier("listenOption")
                    .flAppear(1)
                    Hairline()

                    AddVideoButton(
                        onPicked: { url in
                            let ingest = self.ingest
                            router.dismissCaptureSheet { ingest.submit(.video(url)) }
                        },
                        onFailure: { error in
                            let ingest = self.ingest
                            router.dismissCaptureSheet { ingest.present(error) }
                        }
                    ) {
                        CaptureOption(
                            symbol: "film",
                            title: "Add video",
                            subtitle: "From Photos. Works with any saved Reel or TikTok."
                        )
                    }
                    .buttonStyle(.flPressable)
                    .flAppear(1)
                    Hairline()

                    HStack {
                        CaptureOption(
                            symbol: "doc.on.clipboard",
                            title: "Paste text or a link",
                            subtitle: "French text becomes a lesson right away."
                        )
                        PasteButton(payloadType: String.self) { strings in
                            guard let string = strings.first else { return }
                            let ingest = self.ingest
                            let router = self.router
                            Task { @MainActor in
                                router.dismissCaptureSheet { Self.submitPasted(string, to: ingest) }
                            }
                        }
                        .labelStyle(.iconOnly)
                        .buttonBorderShape(.capsule)
                        .tint(FLColor.surfaceElevated)
                    }
                    .flAppear(2)
                    Hairline()

                    Button {
                        let router = self.router
                        router.dismissCaptureSheet { router.isShowingHowItWorks = true }
                    } label: {
                        CaptureOption(
                            symbol: "square.and.arrow.up",
                            title: "Share from another app",
                            subtitle: "How to send videos straight to FrenchLens."
                        )
                    }
                    .buttonStyle(.flPressable)
                    .flAppear(3)
                }

                demoLessons
            }
            .padding(.horizontal, FLSpacing.gutter)
            .padding(.bottom, FLSpacing.xl)
        }
        .flSoftTopEdge()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(FLColor.surface)
        .presentationCornerRadius(FLRadius.sheet)
    }

    private var demoLessons: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xs) {
            SectionHeader("Try a demo lesson")
                .padding(.top, FLSpacing.m)
                .flAppear(4)
            ForEach(Array(environment.demoLibrary.lessons.enumerated()), id: \.element.id) { index, demo in
                Button {
                    let environment = self.environment
                    router.dismissCaptureSheet { environment.openDemo(demo) }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(AttributedString.french(demo.analysis.transcript.segments.first?.text ?? demo.analysis.title))
                                .font(.headline)
                                .foregroundStyle(FLColor.textPrimary)
                                .lineLimit(1)
                            Text("\(demo.analysis.cefrLevel.rawValue) · \(demo.analysis.grammar.first?.title ?? demo.analysis.title)")
                                .font(.footnote)
                                .foregroundStyle(FLColor.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(FLColor.textTertiary)
                    }
                    .padding(.vertical, FLSpacing.s)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.flPressable)
                .accessibilityIdentifier("demoLesson.\(demo.id)")
                .flAppear(5 + index)
            }
        }
    }

    private static func submitPasted(_ string: String, to ingest: IngestCoordinator) {
        if URLExtractor.firstURL(in: string) != nil {
            ingest.submit(.link(string))
        } else {
            ingest.submit(.text(string))
        }
    }
}

private struct CaptureOption: View {
    let symbol: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: FLSpacing.m) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(FLColor.textPrimary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(FLColor.textPrimary)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, FLSpacing.m)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
