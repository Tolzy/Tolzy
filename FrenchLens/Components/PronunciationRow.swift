import SwiftUI

struct PronunciationRow: View {
    let note: PronunciationNote
    let level: CEFRLevel
    let playback: SpeechPlayback?
    let onPlay: (SpeechRate) -> Void

    private var id: String { "pronunciation.\(note.id)" }

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            FrenchText(note.phrase, style: .title)
            if let ipa = note.ipa {
                Text(ipa)
                    .font(.system(.body, design: .monospaced))
                    .foregroundStyle(FLColor.textSecondary)
                    .accessibilityLabel("Phonetic spelling \(ipa)")
            }
            Text(note.tip.text(for: level))
                .flTextStyle(.bodySmall)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            AudioControls(
                isPlaying: playback?.utteranceID == id,
                playingRate: playback?.rate,
                onPlay: onPlay
            )
        }
        .padding(.vertical, FLSpacing.l)
        .overlay(alignment: .bottom) { Hairline() }
    }
}
