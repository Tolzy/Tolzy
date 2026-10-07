import SwiftUI

// MARK: - Viewport focus

/// Content softens as it leaves the viewport and sharpens as it arrives,
/// which keeps long lessons feeling like one continuous editorial surface.
private struct ScrollFocusEffect: ViewModifier {
    var strength: Double
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        let moves = motion.allowsMovement
        let strength = strength
        content.scrollTransition(.interactive.threshold(.visible(0.2)), axis: .vertical) { view, phase in
            view
                .opacity(phase.isIdentity ? 1 : 1 - 0.55 * strength)
                .scaleEffect(phase.isIdentity || !moves ? 1 : 1 - 0.035 * strength,
                             anchor: phase.value < 0 ? .bottom : .top)
                .blur(radius: phase.isIdentity || !moves ? 0 : 2 * strength)
        }
    }
}

extension View {
    /// Scroll-driven focus for rows and sections inside a ScrollView.
    func flScrollFocus(strength: Double = 1) -> some View {
        modifier(ScrollFocusEffect(strength: strength))
    }
}

// MARK: - Stretchy, parallax hero

/// For a header at the top of a ScrollView: stretches with overscroll
/// (direct manipulation, kept under Reduce Motion) and drifts slower than
/// the content when scrolled away (parallax, removed under Reduce Motion).
private struct StretchyHeaderEffect: ViewModifier {
    let height: CGFloat
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        let parallax = motion.allowsMovement
        let height = height
        content.visualEffect { view, proxy in
            let minY = proxy.frame(in: .scrollView).minY
            let stretch = max(minY, 0)
            let scrolled = min(minY, 0)
            return view
                .scaleEffect(1 + stretch / max(height, 1), anchor: .bottom)
                .offset(y: parallax ? -scrolled * 0.4 : 0)
                .brightness(parallax ? Double(scrolled / max(height, 1)) * 0.35 : 0)
        }
    }
}

extension View {
    func flStretchyHeader(height: CGFloat) -> some View {
        modifier(StretchyHeaderEffect(height: height))
    }
}

// MARK: - Scroll offset

private struct ScrollOffsetKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

extension View {
    /// Reports how far this view (place it at the top of the scroll content)
    /// has scrolled past the top of its ScrollView, in points.
    func flOnScrollOffsetChange(_ action: @escaping (CGFloat) -> Void) -> some View {
        background(
            GeometryReader { proxy in
                Color.clear.preference(key: ScrollOffsetKey.self, value: -proxy.frame(in: .scrollView).minY)
            }
        )
        .onPreferenceChange(ScrollOffsetKey.self, perform: action)
    }
}

// MARK: - Collapsing top bar

/// A compact title bar that materialises as the large title scrolls away.
/// Driven continuously by `progress` (0 hidden … 1 fully shown), so it
/// tracks the finger instead of snapping.
struct CollapsingTopBar<Trailing: View>: View {
    let title: String
    let progress: Double
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
                .foregroundStyle(FLColor.textPrimary)
                .opacity(progress)
                .offset(y: (1 - progress) * 6)
            Spacer()
            trailing()
        }
        .padding(.horizontal, FLSpacing.gutter)
        .frame(height: 44)
        .frame(maxWidth: .infinity)
        .background(alignment: .bottom) {
            Rectangle()
                .fill(.bar)
                .overlay(alignment: .bottom) { Hairline() }
                .ignoresSafeArea(edges: .top)
                .opacity(progress)
        }
        .allowsHitTesting(progress > 0.5)
        .accessibilityElement(children: .contain)
        .accessibilityHidden(progress < 0.5)
    }
}

extension CollapsingTopBar where Trailing == EmptyView {
    init(title: String, progress: Double) {
        self.init(title: title, progress: progress, trailing: { EmptyView() })
    }
}

// MARK: - Soft scroll edge

extension View {
    /// Content softly fades and blurs as it scrolls under the top bar
    /// (iOS 26 scroll edge effect). Earlier systems keep their default edge.
    @ViewBuilder
    func flSoftTopEdge() -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            scrollEdgeEffectStyle(.soft, for: .top)
        } else {
            self
        }
        #else
        self
        #endif
    }
}
