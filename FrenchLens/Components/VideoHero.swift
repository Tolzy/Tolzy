import AVFoundation
import SwiftUI

/// The cinematic top of a lesson: the learner's video when we have it,
/// otherwise an editorial poster of the opening line.
struct VideoHero: View {
    let lesson: Lesson
    var playback: PlaybackController?
    var height: CGFloat = 440

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let playback {
                PlayerSurface(player: playback.player)
                    .overlay(alignment: .center) { PlayToggle(playback: playback) }
            } else {
                PosterView(lesson: lesson)
            }

            // Fade into the page so the hero and the lesson read as one surface.
            LinearGradient(
                colors: [FLColor.background.opacity(0), FLColor.background],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: height * 0.35)
            .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipped()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("videoHero")
    }
}

private struct PlayToggle: View {
    let playback: PlaybackController

    var body: some View {
        Button {
            playback.toggle()
        } label: {
            Image(systemName: playback.isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background(.ultraThinMaterial, in: Circle())
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.plain)
        .opacity(playback.isPlaying ? 0.0001 : 1) // stays tappable while playing
        .accessibilityLabel(playback.isPlaying ? "Pause video" : "Play video")
        .sensoryFeedback(.impact(weight: .light), trigger: playback.isPlaying)
    }
}

/// Typography as image: the first sentence, large, on near-black.
private struct PosterView: View {
    let lesson: Lesson

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            FLColor.surface
            // A single soft light source — depth without a gradient "AI" look.
            Circle()
                .fill(FLColor.accent.opacity(0.10))
                .frame(width: 420, height: 420)
                .blur(radius: 120)
                .offset(x: 160, y: -180)

            VStack(alignment: .leading, spacing: FLSpacing.m) {
                Image(systemName: "quote.opening")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(FLColor.textTertiary)
                if let first = lesson.analysis.transcript.segments.first {
                    Text(AttributedString.french(first.text))
                        .font(.system(size: 30, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(FLColor.textPrimary)
                        .lineLimit(4)
                        .minimumScaleFactor(0.7)
                }
                HStack(spacing: 6) {
                    Image(systemName: lesson.source.systemImage)
                    Text(lesson.source.author ?? lesson.source.label)
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(FLColor.textSecondary)
            }
            .padding(.horizontal, FLSpacing.gutter)
            .padding(.bottom, 120)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(lesson.source.label). No video attached.")
    }
}

/// AVPlayerLayer with aspect-fill, wrapped for SwiftUI.
struct PlayerSurface: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> PlayerLayerView {
        let view = PlayerLayerView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: PlayerLayerView, context: Context) {
        if uiView.playerLayer.player !== player {
            uiView.playerLayer.player = player
        }
    }

    final class PlayerLayerView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}
