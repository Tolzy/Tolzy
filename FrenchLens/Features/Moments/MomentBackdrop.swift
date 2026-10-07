import SwiftUI

/// The celebration's sky: the palette rises from the bottom of the screen to
/// the top when it appears, then keeps flowing slowly upward, endlessly and
/// seamlessly, with soft light drifting through it.
struct MomentBackdrop: View {
    let palette: [Color]
    /// 0 → 1: how far the colour has risen up the screen.
    var reveal: Double = 1

    @Environment(\.motion) private var motion

    /// Seconds for the colour to travel one full cycle upward.
    private let cycle: Double = 16

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: 1.0 / 60, paused: !motion.allowsMovement)) { context in
                let time: Double = motion.allowsMovement ? context.date.timeIntervalSinceReferenceDate : 0
                flow(size: proxy.size, time: time)
            }
            .mask(risingMask(height: proxy.size.height))
        }
        .background(palette.first ?? .black)
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    /// A tall gradient of the palette, repeated, sliding upward. Its pattern
    /// repeats every two screen heights, so wrapping around is invisible.
    private func flow(size: CGSize, time: Double) -> some View {
        let height: CGFloat = size.height
        let phase: Double = (time / cycle).truncatingRemainder(dividingBy: 1)
        let offset: CGFloat = -CGFloat(phase) * height * 2
        // Up through the palette and back down, twice: a seamless pattern.
        let down: [Color] = Array(palette.reversed().dropFirst().dropLast())
        var bands: [Color] = []
        bands.append(contentsOf: palette)
        bands.append(contentsOf: down)
        bands.append(contentsOf: palette)
        bands.append(contentsOf: down)
        bands.append(palette.first ?? .black)

        return ZStack(alignment: .top) {
            LinearGradient(colors: bands, startPoint: .bottom, endPoint: .top)
                .frame(width: size.width, height: height * 4)
                // Visible slice runs from 50–75% of the gradient down to 0–25%,
                // which looks identical, so the loop never jumps.
                .offset(y: offset - height)
            lights(size: size, time: time)
        }
        .frame(width: size.width, height: height, alignment: .top)
        .clipped()
    }

    /// Soft orbs of light rising through the colour.
    private func lights(size: CGSize, time: Double) -> some View {
        ZStack {
            ForEach(0..<3, id: \.self) { index in
                light(index: index, size: size, time: time)
            }
        }
        .frame(width: size.width, height: size.height)
        .blendMode(.plusLighter)
    }

    private func light(index: Int, size: CGSize, time: Double) -> some View {
        let i = Double(index)
        let travel: Double = ((time / (cycle * (0.9 + 0.25 * i))) + i * 0.33).truncatingRemainder(dividingBy: 1)
        let y: CGFloat = size.height * (1.1 - CGFloat(travel) * 1.4)
        let sway: Double = sin(time * 0.35 + i * 2.1)
        let x: CGFloat = size.width * (0.3 + 0.2 * CGFloat(i)) + CGFloat(sway) * size.width * 0.15
        let diameter: CGFloat = size.width * (0.8 + 0.2 * CGFloat(i))
        let color: Color = palette[(index + 1) % palette.count]
        return Circle()
            .fill(color.opacity(0.35))
            .frame(width: diameter, height: diameter)
            .blur(radius: diameter * 0.28)
            .position(x: x, y: y)
    }

    /// Colour fills the screen from the bottom up as `reveal` goes to 1.
    private func risingMask(height: CGFloat) -> some View {
        let span: CGFloat = height * 1.7
        let offset: CGFloat = height - CGFloat(reveal) * span
        return LinearGradient(
            stops: [
                .init(color: .clear, location: 0),
                .init(color: .black, location: 0.38),
                .init(color: .black, location: 1),
            ],
            startPoint: .top, endPoint: .bottom
        )
        .frame(height: span)
        .offset(y: offset)
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

/// Tiny sparks drifting upward, like embers. Purely decorative.
struct SparkField: View {
    let color: Color
    var count = 36

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
        let speed: Double = 0.05 + random2 * 0.07
        let progress: Double = (time * speed + random1).truncatingRemainder(dividingBy: 1)
        let x: Double = random1 * Double(size.width) + sin(time * 0.8 + seed) * 14
        let y: Double = Double(size.height) * (1.05 - progress * 1.15)
        let radius: Double = 1 + random2 * 2.2
        let fade: Double = min(progress * 4, 1) * (1 - progress)
        let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
        canvas.opacity = fade * 0.9
        canvas.fill(Path(ellipseIn: rect), with: .color(index % 3 == 0 ? .white : color))
    }
}
