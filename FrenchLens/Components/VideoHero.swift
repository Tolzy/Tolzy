import AVFoundation
import SwiftUI

/// The cinematic top of a lesson: the learner's video when we have it,
/// otherwise an editorial poster of the opening line.
struct VideoHero: View {
    let lesson: Lesson
    var playback: PlaybackController?
    var height: CGFloat = 440
    /// A still frame (e.g. captured while listening) shown behind the poster.
    var posterImageURL: URL?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let playback, lesson.source.hasVideo {
                    PlayerSurface(player: playback.player)
                        .overlay(alignment: .center) { PlayToggle(playback: playback) }
                        .transition(.opacity)
                } else {
                    PosterView(lesson: lesson, imageURL: posterImageURL)
                        .overlay(alignment: .center) {
                            // Listened lessons: play the captured audio.
                            if let playback { PlayToggle(playback: playback).offset(y: -40) }
                        }
                }
            }
            // Scroll-driven: stretches on overscroll, parallaxes when scrolled.
            .flStretchyHeader(height: height)

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
        .buttonStyle(.flPressable)
        .opacity(playback.isPlaying ? 0.0001 : 1) // stays tappable while playing
        .flAnimation(.swap, value: playback.isPlaying)
        .accessibilityLabel(playback.isPlaying ? "Pause video" : "Play video")
        .flHaptic(.surface, trigger: playback.isPlaying)
    }
}

/// Typography as image: the first sentence, large, on near-black.
private struct PosterView: View {
    let lesson: Lesson
    var imageURL: URL?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            FLColor.surface
            if let image = imageURL.flatMap({ UIImage(contentsOfFile: $0.path) }) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .overlay(FLColor.scrim)
                    .accessibilityHidden(true)
            }
            // A single soft light source — depth without a gradient "AI" look.
            DriftingLight()

            VStack(alignment: .leading, spacing: FLSpacing.m) {
                Image(systemName: "quote.opening")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(FLColor.textTertiary)
                    .flAppear(0)
                if let first = lesson.analysis.transcript.segments.first {
                    Text(AttributedString.french(first.text))
                        .font(.system(size: 30, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(FLColor.textPrimary)
                        .lineLimit(4)
                        .minimumScaleFactor(0.7)
                        .flAppear(1, distance: 24)
                }
                HStack(spacing: 6) {
                    Image(systemName: lesson.source.systemImage)
                    Text(lesson.source.author ?? lesson.source.label)
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(FLColor.textSecondary)
                .flAppear(2)
            }
            .padding(.horizontal, FLSpacing.gutter)
            .padding(.bottom, 120)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(lesson.source.label). No video attached.")
    }
}

/// The ambient light behind the poster drifts very slowly — the only
/// motion on the poster, and none under Reduce Motion.
private struct DriftingLight: View {
    @Environment(\.motion) private var motion
    @State private var drifted = false

    var body: some View {
        Circle()
            .fill(FLColor.accent.opacity(0.10))
            .frame(width: 420, height: 420)
            .blur(radius: 120)
            .offset(x: drifted ? 120 : 170, y: drifted ? -150 : -190)
            .onAppear {
                motion.loop(duration: 9) { drifted = true }
            }
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
