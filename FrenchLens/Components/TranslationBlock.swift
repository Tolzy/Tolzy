import SwiftUI

/// "Meaning": the natural English first; the literal version on request.
struct TranslationBlock: View {
    let translation: Translation
    @State private var showsLiteral = false
    @Environment(\.motion) private var motion

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            Text(translation.natural)
                .font(.system(.title3, weight: .regular))
                .foregroundStyle(FLColor.textPrimary.opacity(0.88))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            if let literal = translation.literal {
                Button {
                    motion.perform(.reveal) { showsLiteral.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        Text(showsLiteral ? "Hide word for word" : "Word for word")
                        Image(systemName: "chevron.down")
                            .rotationEffect(.degrees(showsLiteral ? 180 : 0))
                    }
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(FLColor.textSecondary)
                }
                .buttonStyle(.plain)

                if showsLiteral {
                    Text(literal)
                        .flTextStyle(.mono)
                        .foregroundStyle(FLColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.flReveal(distance: 8))
                }
            }
        }
    }
}
