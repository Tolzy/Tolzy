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
        .background(alignment: .top) {
            // No hard bar or hairline: content melts away under the title.
            SoftTopEdge(depth: 44 + 28)
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

/// Apple-style soft edge: content blurs and fades as it scrolls up under
/// the status bar or a top bar, instead of being cut off by a hard line.
/// A blur that dissolves downward, plus a gentle wash of the background
/// colour so text above it stays legible.
struct SoftTopEdge: View {
    /// How far below the top safe-area edge the effect reaches.
    var depth: CGFloat = 20
    /// Extend up through the status bar (off when the view already starts
    /// at the very top of the screen).
    var coversStatusBar = true

    var body: some View {
        Color.clear
            .frame(height: depth)
            .frame(maxWidth: .infinity)
            .background(alignment: .top) {
                if coversStatusBar {
                    edge.ignoresSafeArea(edges: .top)
                } else {
                    edge
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private var edge: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .black, location: 0),
                            .init(color: .black, location: 0.45),
                            .init(color: .black.opacity(0.6), location: 0.7),
                            .init(color: .clear, location: 1),
                        ],
                        startPoint: .top, endPoint: .bottom
                    )
                )
            LinearGradient(
                stops: [
                    .init(color: FLColor.background.opacity(0.75), location: 0),
                    .init(color: FLColor.background.opacity(0.35), location: 0.5),
                    .init(color: FLColor.background.opacity(0), location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )
        }
    }
}

extension View {
    /// A soft, blurred top edge for screens with their own (or no) top bar.
    func flTopBlur(depth: CGFloat = 20) -> some View {
        overlay(alignment: .top) { SoftTopEdge(depth: depth) }
    }
}

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
