import SwiftUI

/// The celebration's sky. A mesh gradient (iOS 18+) whose colours keep
/// rising slowly from the bottom of the screen to the top while its
/// control points drift, so it moves like light, never in bands. On
/// arrival the colour rises from the bottom edge, behind a soft-edged
/// curtain lifting off the screen. No masks, no seams.
struct MomentBackdrop: View {
    /// Bottom → top: deep, mid, light.
    let palette: [Color]
    /// 0 → 1: how far the colour has risen.
    var reveal: Double = 1

    @Environment(\.motion) private var motion

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !motion.allowsMovement)) { context in
                    let time: Double = motion.allowsMovement ? context.date.timeIntervalSinceReferenceDate : 0
                    sky(time: time)
                }
                legibility
                curtain(height: proxy.size.height)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    // MARK: Sky

    @ViewBuilder
    private func sky(time: Double) -> some View {
        if #available(iOS 18.0, *) {
            MeshGradient(width: 3, height: 4, points: Self.points(time: time), colors: colors(time: time), smoothsColors: true)
        } else {
            LinearGradient(colors: palette, startPoint: .bottom, endPoint: .top)
        }
    }

    /// A 3 × 4 grid whose inner points sway gently. Edge points only slide
    /// along their edge so the mesh always fills the screen.
    static func points(time t: Double) -> [SIMD2<Float>] {
        func sway(_ speed: Double, _ phase: Double, _ amount: Double) -> Float {
            Float(sin(t * speed + phase) * amount)
        }
        var points: [SIMD2<Float>] = []
        points.reserveCapacity(12)
        // Top edge.
        points.append(SIMD2<Float>(0, 0))
        points.append(SIMD2<Float>(0.5 + sway(0.31, 0, 0.12), 0))
        points.append(SIMD2<Float>(1, 0))
        // Two inner rows.
        for row in 1...2 {
            let base: Float = Float(row) / 3
            let phase: Double = Double(row) * 3
            points.append(SIMD2<Float>(0, base + sway(0.25, phase, 0.06)))
            points.append(SIMD2<Float>(0.5 + sway(0.21, phase + 1, 0.18), base + sway(0.27, phase + 2, 0.08)))
            points.append(SIMD2<Float>(1, base + sway(0.23, phase + 4, 0.06)))
        }
        // Bottom edge.
        points.append(SIMD2<Float>(0, 1))
        points.append(SIMD2<Float>(0.5 + sway(0.26, 9, 0.12), 1))
        points.append(SIMD2<Float>(1, 1))
        return points
    }

    /// Each row's colour comes from a point on the palette that moves
    /// upward over time; left and right columns lag slightly for depth.
    @available(iOS 18.0, *)
    private func colors(time t: Double) -> [Color] {
        let flow: Double = t / 26
        var result: [Color] = []
        for row in 0..<4 {
            let height: Double = 1 - Double(row) / 3   // 1 at the top
            for column in 0..<3 {
                let lag: Double = column == 1 ? 0 : 0.07 * Double(column - 1)
                result.append(sample(height * 0.85 + 0.08 - flow + lag))
            }
        }
        return result
    }

    /// The palette as a smooth loop: up from deep to light and back down.
    @available(iOS 18.0, *)
    private func sample(_ position: Double) -> Color {
        var x = position.truncatingRemainder(dividingBy: 2)
        if x < 0 { x += 2 }
        let along: Double = x <= 1 ? x : 2 - x
        let scaled: Double = along * Double(palette.count - 1)
        let index = min(Int(scaled), palette.count - 2)
        let fraction = scaled - Double(index)
        return palette[index].mix(with: palette[index + 1], by: fraction)
    }

    // MARK: Layers

    /// Gentle shade at the top and bottom so white text always reads.
    private var legibility: some View {
        LinearGradient(
            stops: [
                .init(color: .black.opacity(0.28), location: 0),
                .init(color: .clear, location: 0.22),
                .init(color: .clear, location: 0.6),
                .init(color: .black.opacity(0.42), location: 1),
            ],
            startPoint: .top, endPoint: .bottom
        )
    }

    /// Deep colour covering the screen that lifts off upward with a soft
    /// lower edge, so the sky appears to rise from the bottom.
    private func curtain(height: CGFloat) -> some View {
        let edge: CGFloat = height * 0.45
        let travel: CGFloat = height + edge
        let base: Color = palette.first ?? .black
        return VStack(spacing: 0) {
            base.frame(height: height)
            LinearGradient(colors: [base, base.opacity(0)], startPoint: .top, endPoint: .bottom)
                .frame(height: edge)
        }
        .offset(y: -CGFloat(reveal) * travel)
        .allowsHitTesting(false)
    }
}

/// Slowly turning rays of light behind the medal.
struct LightRays: View {
    var color: Color = .white
    var count = 18

    @Environment(\.motion) private var motion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !motion.allowsMovement)) { context in
            let time: Double = motion.allowsMovement ? context.date.timeIntervalSinceReferenceDate : 0
            AngularGradient(stops: stops, center: .center, angle: .degrees(time * 6))
                .mask(
                    RadialGradient(colors: [.black, .black.opacity(0.4), .clear], center: .center, startRadius: 40, endRadius: 260)
                )
        }
        .blur(radius: 6)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var stops: [Gradient.Stop] {
        var stops: [Gradient.Stop] = []
        let step = 1.0 / Double(count)
        for i in 0..<count {
            let start = Double(i) * step
            stops.append(.init(color: color.opacity(0), location: start))
            stops.append(.init(color: color.opacity(0.22), location: start + step * 0.25))
            stops.append(.init(color: color.opacity(0), location: start + step * 0.5))
        }
        return stops
    }
}

/// Tiny sparks drifting upward, like embers. Purely decorative.
struct SparkField: View {
    let color: Color
    var count = 30

    @Environment(\.motion) private var motion

    var body: some View {
        if motion.allowsMovement {
            TimelineView(.animation(minimumInterval: 1.0 / 60)) { context in
                let time = context.date.timeIntervalSinceReferenceDate
                Canvas { canvas, size in
                    for index in 0..<count {
                        draw(index: index, time: time, size: size, in: &canvas)
                    }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }

    private func draw(index: Int, time: Double, size: CGSize, in canvas: inout GraphicsContext) {
        let seed = Double(index)
        let random1: Double = (sin(seed * 12.9898) * 43_758.5453).truncatingRemainder(dividingBy: 1).magnitude
        let random2: Double = (sin(seed * 78.233) * 12_345.678).truncatingRemainder(dividingBy: 1).magnitude
        let speed: Double = 0.04 + random2 * 0.06
        let progress: Double = (time * speed + random1).truncatingRemainder(dividingBy: 1)
        let x: Double = random1 * Double(size.width) + sin(time * 0.8 + seed) * 14
        let y: Double = Double(size.height) * (1.05 - progress * 1.15)
        let radius: Double = 0.8 + random2 * 1.8
        let fade: Double = min(progress * 4, 1) * (1 - progress)
        let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
        canvas.opacity = fade * 0.8
        canvas.fill(Path(ellipseIn: rect), with: .color(index % 3 == 0 ? .white : color))
    }
}
