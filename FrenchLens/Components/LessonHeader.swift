import SwiftUI

struct LessonHeader: View {
    let lesson: Lesson

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            HStack(spacing: 6) {
                Text(lesson.source.label)
                if let author = lesson.source.author {
                    Text("·")
                    Text(author)
                }
            }
            .flTextStyle(.label)
            .foregroundStyle(FLColor.textTertiary)

            Text(lesson.analysis.title)
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: FLSpacing.xs) {
                CEFRTag(level: lesson.analysis.cefrLevel)
                Text(lesson.analysis.learningSummary)
                    .font(.footnote)
                    .foregroundStyle(FLColor.textSecondary)
                    .lineLimit(2)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Shown on lessons produced in Demo Mode from the learner's own content.
struct DemoBanner: View {
    var body: some View {
        HStack(alignment: .top, spacing: FLSpacing.s) {
            Image(systemName: "info.circle")
                .foregroundStyle(FLColor.info)
            Text("Demo Mode: this is a sample analysis, not a transcript of what you shared. Connect a backend in Settings to analyse your own content.")
                .font(.footnote)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(FLSpacing.m)
        .flSurface(FLColor.surface, radius: FLRadius.medium)
        .accessibilityElement(children: .combine)
    }
}
