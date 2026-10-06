import SwiftUI

/// A lesson in a list: thumbnail, source, opening line, level and age.
struct LessonRow: View {
    let lesson: Lesson
    var thumbnailURL: URL?
    /// When set, the thumbnail is the source of the lesson's zoom transition.
    var zoomNamespace: Namespace.ID?

    var body: some View {
        HStack(spacing: FLSpacing.m) {
            thumbnail

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
                    .transition(.flSwap)
            }
        }
        .padding(.vertical, FLSpacing.s)
        .contentShape(Rectangle())
        .flAnimation(.emphasis, value: lesson.isSaved)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var thumbnail: some View {
        let view = LessonThumbnail(lesson: lesson, imageURL: thumbnailURL)
            .frame(width: 56, height: 72)
        if let zoomNamespace {
            view.flZoomSource(id: lesson.id, in: zoomNamespace)
        } else {
            view
        }
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
