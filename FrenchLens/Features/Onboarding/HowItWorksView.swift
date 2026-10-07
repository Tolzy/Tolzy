import SwiftUI

struct HowItWorksView: View {
    @Environment(\.dismiss) private var dismiss

    private let steps: [(String, String)] = [
        ("Find French", "A Reel, a TikTok, a YouTube Short — anything with French in it."),
        ("Share to FrenchLens", "Tap Share, then FrenchLens. First time? Tap More (•••) at the end of the app row and switch FrenchLens on."),
        ("Understand, then learn", "Open FrenchLens. Tap any word, see every verb, and save what you want to review."),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FLSpacing.xl) {
                    Text("Turn the French you scroll past into lessons.")
                        .flTextStyle(.display)
                        .foregroundStyle(FLColor.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .flAppear(0, distance: 24)

                    VStack(alignment: .leading, spacing: FLSpacing.l) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            HStack(alignment: .firstTextBaseline, spacing: FLSpacing.m) {
                                Text("\(index + 1)")
                                    .font(.system(.title, design: .monospaced, weight: .semibold))
                                    .foregroundStyle(index == 1 ? FLColor.accent : FLColor.textTertiary)
                                    .frame(width: 28, alignment: .leading)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(step.0)
                                        .flTextStyle(.headline)
                                        .foregroundStyle(FLColor.textPrimary)
                                    Text(step.1)
                                        .flTextStyle(.body)
                                        .foregroundStyle(FLColor.textSecondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .accessibilityElement(children: .combine)
                            .flAppear(index + 1)
                        }
                    }

                    VStack(alignment: .leading, spacing: FLSpacing.s) {
                        SectionHeader("About Instagram and other apps")
                        Text("Each app decides what it shares. Some send the video itself; many send only a link. FrenchLens never downloads videos from links or accesses private content.")
                            .flTextStyle(.body)
                            .foregroundStyle(FLColor.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("If only a link arrives, save the video to Photos and choose Add video. It always works.")
                            .flTextStyle(.body)
                            .foregroundStyle(FLColor.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(FLSpacing.l)
                    .flSurface(FLColor.surface, radius: FLRadius.large)
                    .flAppear(steps.count + 1)
                }
                .padding(FLSpacing.gutter)
            }
            .flSoftTopEdge()
            .background(FLColor.background.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationBackground(FLColor.background)
    }
}
