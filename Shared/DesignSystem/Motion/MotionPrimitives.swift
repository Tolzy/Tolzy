import SwiftUI
import UIKit

// MARK: - Lens pulse (phase animation)

/// The FrenchLens glyph "focusing": the ring breathes, the blue focal point
/// tightens, and a faint ripple leaves the lens. Used while understanding.
/// Static under Reduce Motion.
struct LensPulse: View {
    var size: CGFloat = 44
    @Environment(\.motion) private var motion

    private enum Phase: CaseIterable {
        case rest, focus, release

        var ringScale: CGFloat { self == .focus ? 0.92 : 1 }
        var dotScale: CGFloat {
            switch self {
            case .rest: 1
            case .focus: 1.35
            case .release: 0.9
            }
        }
        var rippleScale: CGFloat { self == .release ? 1.9 : 1 }
        var rippleOpacity: Double { self == .focus ? 0.5 : 0 }
    }

    var body: some View {
        if motion.allowsMovement {
            PhaseAnimator(Phase.allCases) { phase in
                lens(ring: phase.ringScale, dot: phase.dotScale, ripple: phase.rippleScale, rippleOpacity: phase.rippleOpacity)
            } animation: { phase -> Animation? in
                switch phase {
                case .rest: return Animation.easeInOut(duration: 0.9)
                case .focus: return Animation.spring(duration: 0.7, bounce: 0.3)
                case .release: return Animation.easeOut(duration: 0.8)
                }
            }
            .accessibilityHidden(true)
        } else {
            lens(ring: 1, dot: 1, ripple: 1, rippleOpacity: 0)
                .accessibilityHidden(true)
        }
    }

    private func lens(ring: CGFloat, dot: CGFloat, ripple: CGFloat, rippleOpacity: Double) -> some View {
        ZStack {
            Circle()
                .strokeBorder(FLColor.accent.opacity(rippleOpacity), lineWidth: 1)
                .scaleEffect(ripple)
            Circle()
                .strokeBorder(FLColor.textPrimary, lineWidth: max(1.5, size * 0.1))
                .scaleEffect(ring)
            Circle()
                .fill(FLColor.accent)
                .frame(width: size * 0.3, height: size * 0.3)
                .scaleEffect(dot)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Drawn checkmark

struct CheckmarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.2, y: rect.minY + rect.height * 0.53))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.42, y: rect.minY + rect.height * 0.74))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.8, y: rect.minY + rect.height * 0.3))
        return path
    }
}

/// A ring that closes, then a checkmark that draws itself. The "done" moment.
struct DrawnCheckmark: View {
    var size: CGFloat = 44
    var color: Color = FLColor.accent
    @Environment(\.motion) private var motion
    @State private var ring: CGFloat = 0
    @State private var tick: CGFloat = 0

    var body: some View {
        ZStack {
            Circle()
                .trim(from: 0, to: ring)
                .stroke(color.opacity(0.35), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            CheckmarkShape()
                .trim(from: 0, to: tick)
                .stroke(color, style: StrokeStyle(lineWidth: max(2, size * 0.07), lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .onAppear {
            guard motion.allowsMovement else {
                ring = 1
                tick = 1
                return
            }
            withAnimation(.easeOut(duration: 0.45)) { ring = 1 }
            withAnimation(.spring(duration: 0.45, bounce: 0).delay(0.28)) { tick = 1 }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Shimmer

/// A slow highlight sweeping across text — for "working" titles. Ambient,
/// so it simply doesn't run under Reduce Motion.
private struct ShimmerEffect: ViewModifier {
    var isActive: Bool
    @Environment(\.motion) private var motion
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        if isActive && motion.allowsMovement {
            content
                .overlay {
                    GeometryReader { proxy in
                        LinearGradient(
                            colors: [.clear, FLColor.textPrimary.opacity(0.55), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: proxy.size.width * 0.6)
                        .offset(x: proxy.size.width * phase)
                    }
                    .mask { content }
                    .allowsHitTesting(false)
                }
                .onAppear {
                    motion.loop(duration: 2.2, autoreverses: false) { phase = 1.4 }
                }
        } else {
            content
        }
    }
}

extension View {
    func flShimmer(_ isActive: Bool = true) -> some View {
        modifier(ShimmerEffect(isActive: isActive))
    }
}

// MARK: - Toast

/// A brief confirmation that floats in from the top and leaves on its own.
struct ToastBanner: View {
    let message: String
    var systemImage: String = "checkmark"

    var body: some View {
        HStack(spacing: FLSpacing.xs) {
            Image(systemName: systemImage)
                .font(.footnote.weight(.bold))
                .foregroundStyle(FLColor.accent)
            Text(message)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FLColor.textPrimary)
        }
        .padding(.horizontal, FLSpacing.m)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(FLColor.separator, lineWidth: 0.5))
        .flElevation(.raised)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}

private struct ToastModifier: ViewModifier {
    @Binding var message: String?
    var systemImage: String
    @Environment(\.motion) private var motion

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let message {
                    ToastBanner(message: message, systemImage: systemImage)
                        .padding(.top, FLSpacing.xs)
                        .transition(.flPanel)
                        .task(id: message) {
                            UIAccessibility.post(notification: .announcement, argument: message)
                            try? await Task.sleep(for: .seconds(1.8))
                            motion.perform(.panel) { self.message = nil }
                        }
                }
            }
            .flAnimation(.panel, value: message)
    }
}

extension View {
    /// Shows `message` as a toast; clears the binding when it leaves.
    func flToast(_ message: Binding<String?>, systemImage: String = "checkmark") -> some View {
        modifier(ToastModifier(message: message, systemImage: systemImage))
    }
}
