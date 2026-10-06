import SwiftUI

/// A lesson in a list: thumbnail, source, opening line, level and age.
struct LessonRow: View {
    let lesson: Lesson
    var thumbnailURL: URL?

    var body: some View {
        HStack(spacing: FLSpacing.m) {
            LessonThumbnail(lesson: lesson, imageURL: thumbnailURL)
                .frame(width: 56, height: 72)

            VStack(alignment: .leading, spacing: 5) {
                Text(lesson.source.label)
                    .flTextStyle(.label)
                    .foregroundStyle(FLColor.textTertiary)
                Text(AttributedString.french("“\(lesson.previewLine)”"))
                    .font(.system(.headline, weight: .semibold))
                    .foregroundStyle(FLColor.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text("\(lesson.analysis.cefrLevel.rawValue) · \(lesson.createdAt.relativeDescription)")
                    .font(.footnote)
                    .foregroundStyle(FLColor.textSecondary)
            }

            Spacer(minLength: 0)

            if lesson.isSaved {
                Image(systemName: "bookmark.fill")
                    .font(.caption)
                    .foregroundStyle(FLColor.textTertiary)
                    .accessibilityLabel("Saved")
            }
        }
        .padding(.vertical, FLSpacing.s)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct LessonThumbnail: View {
    let lesson: Lesson
    var imageURL: URL?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: FLRadius.small, style: .continuous)
                .fill(FLColor.surfaceElevated)
            if let image = imageURL.flatMap({ UIImage(contentsOfFile: $0.path) }) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "quote.opening")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(FLColor.textTertiary)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: FLRadius.small, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: FLRadius.small, style: .continuous)
                .strokeBorder(FLColor.separator, lineWidth: 0.5)
        )
        .accessibilityHidden(true)
    }
}

extension Date {
    /// "4 min ago", "2 hr ago", "yesterday".
    var relativeDescription: String {
        if abs(timeIntervalSinceNow) < 60 { return "just now" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        formatter.dateTimeStyle = .named
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}
