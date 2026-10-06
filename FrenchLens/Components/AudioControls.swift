import SwiftUI

/// "Play" and "Slow" for a sentence or phrase.
struct AudioControls: View {
    let isPlaying: Bool
    let playingRate: SpeechRate?
    let onPlay: (SpeechRate) -> Void

    var body: some View {
        HStack(spacing: FLSpacing.xs) {
            pill(title: "Play", systemImage: "play.fill", rate: .normal)
            pill(title: "Slow", systemImage: "tortoise.fill", rate: .slow)
        }
    }

    private func pill(title: String, systemImage: String, rate: SpeechRate) -> some View {
        let active = isPlaying && playingRate == rate
        return Button {
            onPlay(rate)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: active ? "speaker.wave.2.fill" : systemImage)
                    .symbolEffect(.variableColor.iterative, isActive: active)
                Text(title)
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(active ? FLColor.accent : FLColor.textSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(active ? FLColor.accentSoft : FLColor.surfaceElevated))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(rate == .slow ? "Play slowly" : "Play")
    }
}

/// A single speaker button for words and examples.
struct SpeakButton: View {
    let isPlaying: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isPlaying ? "speaker.wave.2.fill" : "speaker.wave.2")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(isPlaying ? FLColor.accent : FLColor.textSecondary)
                .symbolEffect(.variableColor.iterative, isActive: isPlaying)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Listen")
    }
}
