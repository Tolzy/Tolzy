import SwiftUI

/// The app's four destinations, on the native tab bar.
struct BottomNavigation<Content: View>: View {
    @Binding var selection: AppTab
    @ViewBuilder let content: (AppTab) -> Content

    var body: some View {
        TabView(selection: $selection) {
            ForEach(AppTab.allCases) { tab in
                content(tab)
                    .tabItem { Label(tab.title, systemImage: tab.systemImage) }
                    .tag(tab)
            }
        }
        // Monochrome: blue is reserved for signals inside content.
        .tint(FLColor.textPrimary)
        .sensoryFeedback(.selection, trigger: selection)
    }
}
