import SwiftUI

/// "What should Camille call you?" — the name helps speech recognition hear
/// it, and the respelling makes the French voice say it right.
struct NameSheet: View {
    @Environment(AppSettings.self) private var settings
    @Environment(\.tts) private var tts
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var soundsLike = ""
    @FocusState private var focusedField: Field?

    private enum Field { case name, soundsLike }

    private var suggestedSpelling: String {
        ConversationFlow.frenchRespelling(of: name.trimmingCharacters(in: .whitespaces))
    }

    private var spoken: String {
        soundsLike.trimmingCharacters(in: .whitespaces).isEmpty ? suggestedSpelling : soundsLike
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Your first name", text: $name)
                        .textContentType(.givenName)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .name)
                        .accessibilityIdentifier("name.field")
                } footer: {
                    Text("Camille will use it, and FrenchLens listens for it when you speak.")
                }

                if !name.trimmingCharacters(in: .whitespaces).isEmpty {
                    Section {
                        HStack {
                            TextField(suggestedSpelling, text: $soundsLike)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.words)
                                .focused($focusedField, equals: .soundsLike)
                            Button {
                                tts.speak("Bonjour \(spoken) !", id: "name.preview", rate: .normal)
                            } label: {
                                Label("Hear it", systemImage: "speaker.wave.2.fill")
                                    .labelStyle(.iconOnly)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(FLColor.accent)
                                    .frame(width: 36, height: 36)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Hear how Camille says it")
                        }
                    } header: {
                        Text("How Camille says it")
                    } footer: {
                        Text("French reads names its own way. If it doesn't sound right, spell it the way it sounds, then tap the speaker.")
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(FLColor.background.ignoresSafeArea())
            .navigationTitle("Your name")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.semibold)
                        .accessibilityIdentifier("name.save")
                }
            }
            .onAppear {
                name = settings.learnerName
                soundsLike = settings.namePronunciation
                if name.isEmpty { focusedField = .name }
            }
            .onDisappear { tts.stop() }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        settings.learnerName = name
        // Only keep a custom spelling when it differs from the automatic one.
        let custom = soundsLike.trimmingCharacters(in: .whitespaces)
        settings.namePronunciation = custom == suggestedSpelling ? "" : custom
        dismiss()
    }
}
