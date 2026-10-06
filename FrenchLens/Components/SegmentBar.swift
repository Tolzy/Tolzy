import SwiftUI

/// Editorial text tabs with a sliding underline, for progressive disclosure.
struct SegmentBar<Item: Hashable & Identifiable>: View {
    let items: [Item]
    @Binding var selection: Item
    let title: (Item) -> String

    @Namespace private var underline
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: FLSpacing.l) {
                ForEach(items) { item in
                    let isSelected = item == selection
                    Button {
                        withAnimation(FLMotion.resolve(FLMotion.spring, reduceMotion: reduceMotion)) {
                            selection = item
                        }
                    } label: {
                        VStack(spacing: 8) {
                            Text(title(item))
                                .font(.system(.subheadline, weight: .semibold))
                                .foregroundStyle(isSelected ? FLColor.textPrimary : FLColor.textTertiary)
                            ZStack {
                                Capsule().fill(.clear).frame(height: 2)
                                if isSelected {
                                    Capsule()
                                        .fill(FLColor.textPrimary)
                                        .frame(height: 2)
                                        .matchedGeometryEffect(id: "underline", in: underline)
                                }
                            }
                        }
                        .fixedSize()
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                    .accessibilityIdentifier("segment.\(title(item))")
                }
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
        .overlay(alignment: .bottom) { Hairline() }
    }
}
