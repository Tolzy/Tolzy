import SwiftUI

/// The signature verb breakdown: form used → infinitive → tense → table.
struct VerbCard: View {
    let verb: VerbAnalysis
    let level: CEFRLevel
    var isCompact = false
    var speakingID: String?
    var onSpeak: ((String, String) -> Void)?

    @State private var showsConjugation = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            VStack(alignment: .leading, spacing: 6) {
                Text(AttributedString.french(verb.formUsed.uppercased()))
                    .font(.system(isCompact ? Font.TextStyle.title3 : Font.TextStyle.title, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(FLColor.textPrimary)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(AttributedString.french(verb.infinitive))
                        .font(.headline)
                        .foregroundStyle(FLColor.accent)
                    Text("· \(verb.english)")
                        .font(.subheadline)
                        .foregroundStyle(FLColor.textSecondary)
                }
            }

            metadata

            if !isCompact {
                if let note = verb.note {
                    Text(note.text(for: level))
                        .flTextStyle(.bodySmall)
                        .foregroundStyle(FLColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let example = verb.example {
                    HStack(alignment: .top, spacing: FLSpacing.xs) {
                        VStack(alignment: .leading, spacing: 2) {
                            FrenchText(example, style: .body)
                            if let translation = verb.exampleTranslation {
                                Text(translation)
                                    .font(.footnote)
                                    .foregroundStyle(FLColor.textTertiary)
                            }
                        }
                        Spacer(minLength: 0)
                        if let onSpeak {
                            let id = "verb.example.\(verb.id)"
                            SpeakButton(isPlaying: speakingID == id) { onSpeak(example, id) }
                        }
                    }
                }

                conjugationDisclosure
            }
        }
        .padding(FLSpacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flSurface(FLColor.surface, radius: FLRadius.large)
        .accessibilityIdentifier("verbCard.\(verb.infinitive)")
    }

    private var metadata: some View {
        VStack(alignment: .leading, spacing: 4) {
            MetadataLine(label: "Tense", value: verb.tense)
            MetadataLine(label: "Person", value: verb.person)
            if let auxiliary = verb.auxiliary {
                MetadataLine(label: "Helper", value: auxiliary)
            }
        }
    }

    private var conjugationDisclosure: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            Button {
                withAnimation(FLMotion.resolve(FLMotion.spring, reduceMotion: reduceMotion)) {
                    showsConjugation.toggle()
                }
            } label: {
                HStack {
                    Text("Conjugation")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FLColor.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FLColor.textTertiary)
                        .rotationEffect(.degrees(showsConjugation ? 180 : 0))
                }
                .padding(.top, FLSpacing.xs)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(showsConjugation ? "Hides the table" : "Shows every form")

            if showsConjugation {
                ConjugationTable(rows: verb.conjugation, highlighted: verb.usedRow)
                    .transition(AnyTransition.opacity.combined(with: .move(edge: .top)))
            }
        }
        .overlay(alignment: .top) { Hairline() }
    }
}

struct MetadataLine: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: FLSpacing.s) {
            Text(label)
                .flTextStyle(.label)
                .foregroundStyle(FLColor.textTertiary)
                .frame(width: 64, alignment: .leading)
            Text(value)
                .font(.subheadline)
                .foregroundStyle(FLColor.textPrimary)
        }
        .accessibilityElement(children: .combine)
    }
}

struct ConjugationTable: View {
    let rows: [ConjugationRow]
    var highlighted: ConjugationRow?

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: FLSpacing.m, verticalSpacing: 8) {
            ForEach(rows) { row in
                let isUsed = row == highlighted
                GridRow {
                    Text(AttributedString.french(row.pronoun))
                        .font(.subheadline)
                        .foregroundStyle(FLColor.textTertiary)
                    Text(AttributedString.french(row.form))
                        .font(.subheadline.weight(isUsed ? .semibold : .regular))
                        .foregroundStyle(isUsed ? FLColor.accent : FLColor.textPrimary)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}
