import SwiftUI

/// A ChatGPT-style conversation for speaking practice: Camille's replies
/// stream in and are read aloud; hold a conversation by voice or keyboard.
struct ConversationView: View {
    @State private var controller: ConversationController
    @State private var input = SpeakInput()
    @State private var draft = ""
    @State private var isInVoiceMode = false
    @State private var didOpenVoice = false
    @FocusState private var isTyping: Bool
    @Environment(AppEnvironment.self) private var environment

    @Environment(\.tts) private var tts

    init(scenario: PracticeScenario, engine: TutorEngine) {
        _controller = State(initialValue: ConversationController(scenario: scenario, engine: engine))
    }

    var body: some View {
        ConversationContent(controller: controller, input: input, draft: $draft, isTyping: $isTyping) {
            input.cancel()
            isTyping = false
            controller.tts.stop()
            isInVoiceMode = true
        }
            .background(FLColor.background.ignoresSafeArea())
            .navigationTitle(controller.scenario.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { optionsMenu }
            }
            .task {
                controller.tts = tts
                if controller.scenario.startsInVoice, !didOpenVoice {
                    // Voice mode opens the conversation itself.
                    didOpenVoice = true
                    isInVoiceMode = true
                } else if !isInVoiceMode {
                    controller.start()
                }
            }
            .fullScreenCover(isPresented: $isInVoiceMode) {
                VoiceModeView(controller: controller, usesMicrophone: !environment.isUITesting)
            }
            .onDisappear {
                guard !isInVoiceMode else { return }
                controller.stop()
                input.cancel()
            }
    }

    private var optionsMenu: some View {
        @Bindable var controller = controller
        return Menu {
            Toggle(isOn: $controller.showsEnglish) {
                Label("Show English", systemImage: "character.bubble")
            }
            Toggle(isOn: $controller.autoSpeak) {
                Label("Read replies aloud", systemImage: "speaker.wave.2")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(FLColor.textPrimary)
                .frame(width: 36, height: 36)
                .background(.ultraThinMaterial, in: Circle())
        }
        .accessibilityLabel("Conversation options")
        .accessibilityIdentifier("conversation.options")
    }
}

private struct ConversationContent: View {
    let controller: ConversationController
    let input: SpeakInput
    @Binding var draft: String
    var isTyping: FocusState<Bool>.Binding
    let onVoiceMode: () -> Void

    @Environment(\.motion) private var motion

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: FLSpacing.m) {
                    header
                        .padding(.bottom, FLSpacing.xs)

                    ForEach(controller.messages) { message in
                        MessageRow(message: message, controller: controller)
                            .id(message.id)
                            .transition(.flReveal(distance: 14))
                    }

                    if let error = controller.errorMessage {
                        ConversationError(message: error) { controller.retry() }
                            .transition(.flReveal)
                    }

                    Color.clear.frame(height: 1).id(ConversationContent.bottomID)
                }
                .padding(.horizontal, FLSpacing.gutter)
                .padding(.top, FLSpacing.m)
                .padding(.bottom, FLSpacing.m)
                .flAnimation(.reveal, value: controller.messages.count)
                .flAnimation(.swap, value: controller.errorMessage)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: scrollKey) { _, _ in
                motion.perform(.swap) { proxy.scrollTo(ConversationContent.bottomID, anchor: .bottom) }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Composer(controller: controller, input: input, draft: $draft, isTyping: isTyping, onVoiceMode: onVoiceMode) {
                    proxy.scrollTo(ConversationContent.bottomID, anchor: .bottom)
                }
            }
        }
    }

    static let bottomID = "conversation.bottom"

    /// Changes whenever new text arrives, so the newest words stay in view.
    private var scrollKey: String {
        let last = controller.messages.last
        return "\(controller.messages.count)-\(last?.text.count ?? 0)-\(last?.correction.count ?? 0)-\(controller.errorMessage ?? "")-\(controller.showsEnglish)"
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xs) {
            HStack(spacing: FLSpacing.xs) {
                Image(systemName: controller.scenario.systemImage)
                    .foregroundStyle(FLColor.accent)
                Text(controller.scenario.subtitle)
                    .foregroundStyle(FLColor.textSecondary)
            }
            .font(.footnote.weight(.medium))

            if !controller.isLive {
                Label("Sample replies. Turn on Apple Intelligence for a real conversation.", systemImage: "sparkles")
                    .font(.footnote)
                    .foregroundStyle(FLColor.textTertiary)
                    .accessibilityIdentifier("conversation.sampleNotice")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Messages

private struct MessageRow: View {
    let message: ChatMessage
    let controller: ConversationController

    var body: some View {
        switch message.role {
        case .tutor: TutorBubble(message: message, controller: controller)
        case .learner: LearnerBubble(message: message, controller: controller)
        }
    }
}

private struct TutorBubble: View {
    let message: ChatMessage
    let controller: ConversationController
    @State private var revealsEnglish = false
    @Environment(\.motion) private var motion

    private var showsEnglish: Bool { controller.showsEnglish || revealsEnglish }

    var body: some View {
        HStack(alignment: .top, spacing: FLSpacing.s) {
            Text("C")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(FLColor.textOnAccent)
                .frame(width: 28, height: 28)
                .background(Circle().fill(FLColor.accent))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: FLSpacing.xs) {
                if message.text.isEmpty {
                    ThinkingDots()
                        .padding(.vertical, FLSpacing.xs)
                        .accessibilityLabel("Camille is replying")
                } else {
                    Text(AttributedString.french(message.text))
                        .font(.system(.body, weight: .medium))
                        .foregroundStyle(FLColor.textPrimary)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("chat.tutor")
                }

                if showsEnglish, !message.english.isEmpty, !message.isStreaming {
                    Text(message.english)
                        .font(.subheadline)
                        .foregroundStyle(FLColor.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.flReveal(distance: 6))
                }

                if !message.isStreaming, !message.text.isEmpty {
                    HStack(spacing: FLSpacing.m) {
                        BubbleAction(
                            title: controller.isSpeaking(message) ? "Stop" : "Play",
                            systemImage: controller.isSpeaking(message) ? "stop.fill" : "speaker.wave.2.fill",
                            isActive: controller.isSpeaking(message)
                        ) { controller.speak(message) }

                        if !controller.showsEnglish, !message.english.isEmpty {
                            BubbleAction(
                                title: revealsEnglish ? "Hide English" : "English",
                                systemImage: "character.bubble",
                                isActive: revealsEnglish
                            ) {
                                motion.perform(.swap) { revealsEnglish.toggle() }
                            }
                        }
                    }
                    .transition(.opacity)
                }
            }
            Spacer(minLength: FLSpacing.l)
        }
        .flAnimation(.swap, value: message.isStreaming)
        .flAnimation(.swap, value: showsEnglish)
    }
}

private struct LearnerBubble: View {
    let message: ChatMessage
    let controller: ConversationController

    var body: some View {
        VStack(alignment: .trailing, spacing: FLSpacing.xs) {
            HStack {
                Spacer(minLength: FLSpacing.xxl)
                Text(message.text)
                    .font(.body)
                    .foregroundStyle(FLColor.textOnAccent)
                    .padding(.horizontal, FLSpacing.m)
                    .padding(.vertical, FLSpacing.s)
                    .background(
                        RoundedRectangle(cornerRadius: FLRadius.large, style: .continuous)
                            .fill(FLColor.accent)
                    )
                    .textSelection(.enabled)
                    .accessibilityIdentifier("chat.learner")
            }

            if !message.correction.isEmpty {
                CorrectionCard(message: message, controller: controller)
                    .transition(.flReveal(distance: 8))
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .flAnimation(.reveal, value: message.correction)
    }
}

/// "A more natural way to say it", under the learner's message.
private struct CorrectionCard: View {
    let message: ChatMessage
    let controller: ConversationController

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xxs) {
            HStack(spacing: FLSpacing.xxs) {
                Image(systemName: "wand.and.sparkles")
                Text("More natural")
            }
            .flTextStyle(.label)
            .foregroundStyle(FLColor.success)

            Text(AttributedString.french(message.correction))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FLColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            if !message.tip.isEmpty {
                Text(message.tip)
                    .font(.footnote)
                    .foregroundStyle(FLColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            BubbleAction(
                title: controller.isSpeaking(message) ? "Stop" : "Hear it",
                systemImage: controller.isSpeaking(message) ? "stop.fill" : "speaker.wave.2.fill",
                isActive: controller.isSpeaking(message)
            ) { controller.speak(message) }
            .padding(.top, 2)
        }
        .padding(FLSpacing.s)
        .frame(maxWidth: 300, alignment: .leading)
        .flSurface(FLColor.surface, radius: FLRadius.medium)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("chat.correction")
    }
}

private struct BubbleAction: View {
    let title: String
    let systemImage: String
    var isActive = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(isActive ? FLColor.accent : FLColor.textSecondary)
                .contentTransition(.symbolEffect(.replace))
                .padding(.vertical, 4)
                .contentShape(Rectangle())
        }
        .buttonStyle(FLPressableStyle(scale: 0.94, highlights: false))
    }
}

/// Three dots breathing in sequence while Camille is thinking.
private struct ThinkingDots: View {
    @Environment(\.motion) private var motion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !motion.allowsMovement)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    let phase = motion.allowsMovement ? (sin(time * 5 - Double(index) * 0.8) + 1) / 2 : 0.5
                    Circle()
                        .fill(FLColor.textTertiary)
                        .frame(width: 7, height: 7)
                        .scaleEffect(0.75 + 0.35 * phase)
                        .opacity(0.45 + 0.55 * phase)
                }
            }
        }
    }
}

private struct ConversationError: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: FLSpacing.s) {
            Image(systemName: "exclamationmark.bubble")
                .foregroundStyle(FLColor.warning)
            VStack(alignment: .leading, spacing: FLSpacing.xs) {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(FLColor.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again", action: retry)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FLColor.accent)
                    .accessibilityIdentifier("conversation.retry")
            }
        }
        .padding(FLSpacing.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flSurface(FLColor.surface, radius: FLRadius.medium)
    }
}

// MARK: - Composer

/// Type, or tap the microphone and talk. While listening, the words appear
/// live; tap again to send what you said.
private struct Composer: View {
    let controller: ConversationController
    let input: SpeakInput
    @Binding var draft: String
    var isTyping: FocusState<Bool>.Binding
    let onVoiceMode: () -> Void
    let onSend: () -> Void

    @Environment(\.motion) private var motion

    private var trimmedDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSend: Bool { !trimmedDraft.isEmpty && !controller.isResponding }

    var body: some View {
        VStack(alignment: .leading, spacing: FLSpacing.s) {
            if let error = input.errorMessage {
                HStack(alignment: .top, spacing: FLSpacing.xs) {
                    Image(systemName: "mic.slash")
                    Text(error).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button {
                        input.clearError()
                    } label: {
                        Image(systemName: "xmark").font(.footnote.weight(.semibold))
                    }
                    .accessibilityLabel("Dismiss")
                }
                .font(.footnote)
                .foregroundStyle(FLColor.textSecondary)
                .transition(.flReveal(distance: 6))
            } else if !controller.hasLearnerMessages, !input.isRecording, !controller.scenario.vocabulary.isEmpty {
                suggestions
                    .transition(.flReveal(distance: 6))
            }

            if input.state != .idle {
                listeningBar
                    .transition(.flReveal(distance: 8))
            } else {
                typingBar
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, FLSpacing.m)
        .padding(.top, FLSpacing.s)
        .padding(.bottom, FLSpacing.s)
        .background(
            FLColor.background
                .overlay(alignment: .top) { Hairline() }
                .ignoresSafeArea(edges: .bottom)
        )
        .flAnimation(.swap, value: input.state)
        .flAnimation(.swap, value: input.errorMessage)
        .flHaptic(trigger: input.state) { old, new in
            if old == .idle, new == .starting { return FLHaptic.lookup }
            if new == .finishing { return FLHaptic.surface }
            return nil
        }
    }

    /// Words from the scenario, to get a beginner started.
    private var suggestions: some View {
        ScrollView(.horizontal) {
            HStack(spacing: FLSpacing.xs) {
                ForEach(controller.scenario.vocabulary, id: \.self) { word in
                    Button {
                        draft = draft.isEmpty ? String(word.prefix(1)).uppercased() + String(word.dropFirst()) : draft + " " + word
                    } label: {
                        Text(word)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(FLColor.textPrimary)
                            .padding(.horizontal, FLSpacing.s)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(FLColor.surfaceElevated))
                    }
                    .buttonStyle(FLPressableStyle(scale: 0.94, highlights: false))
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private var typingBar: some View {
        HStack(alignment: .bottom, spacing: FLSpacing.xs) {
            TextField("Say something in French", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused(isTyping)
                .submitLabel(.send)
                .onSubmit(send)
                .autocorrectionDisabled()
                .padding(.horizontal, FLSpacing.m)
                .padding(.vertical, 11)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(FLColor.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .strokeBorder(FLColor.hairline, lineWidth: 0.5)
                        )
                )
                .accessibilityIdentifier("conversation.input")

            if trimmedDraft.isEmpty {
                RoundButton(systemImage: "mic", label: "Dictate", filled: false, isEnabled: !controller.isResponding) {
                    isTyping.wrappedValue = false
                    Task { await input.start() }
                }
                .accessibilityIdentifier("conversation.mic")
                .transition(.scale(scale: 0.6).combined(with: .opacity))

                RoundButton(systemImage: "waveform", label: "Voice conversation", filled: true, isEnabled: true, action: onVoiceMode)
                    .accessibilityIdentifier("voice.open")
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            } else {
                RoundButton(systemImage: "arrow.up", label: "Send", filled: true, isEnabled: canSend, action: send)
                    .accessibilityIdentifier("conversation.send")
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .flAnimation(.tap, value: trimmedDraft.isEmpty)
    }

    private var listeningBar: some View {
        HStack(alignment: .center, spacing: FLSpacing.s) {
            RoundButton(systemImage: "xmark", label: "Cancel", filled: false, isEnabled: true) {
                input.cancel()
            }

            VStack(alignment: .leading, spacing: 4) {
                LevelMeter(level: input.level, isActive: input.state == .recording)
                Text(input.transcript.isEmpty ? (input.state == .finishing ? "Finishing…" : "Listening… speak in French") : input.transcript)
                    .font(.subheadline)
                    .foregroundStyle(input.transcript.isEmpty ? FLColor.textTertiary : FLColor.textPrimary)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentTransition(.opacity)
                    .accessibilityIdentifier("conversation.liveTranscript")
            }

            RoundButton(systemImage: "arrow.up", label: "Send what you said", filled: true, isEnabled: input.state == .recording) {
                Task {
                    let said = await input.finish()
                    guard !said.isEmpty else { return }
                    controller.send(said)
                    onSend()
                }
            }
            .accessibilityIdentifier("conversation.stopRecording")
        }
        .padding(.leading, FLSpacing.xxs)
        .padding(.vertical, FLSpacing.xxs)
    }

    private func send() {
        guard canSend else { return }
        controller.send(trimmedDraft)
        draft = ""
        onSend()
    }
}

private struct RoundButton: View {
    let systemImage: String
    let label: String
    var filled: Bool
    var isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(filled ? FLColor.textOnAccent : FLColor.textPrimary)
                .frame(width: 44, height: 44)
                .background(Circle().fill(filled ? FLColor.accent : FLColor.surfaceElevated))
                .opacity(isEnabled ? 1 : 0.4)
                .contentShape(Circle())
        }
        .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
        .disabled(!isEnabled)
        .accessibilityLabel(label)
    }
}

/// Bars that follow the microphone level.
private struct LevelMeter: View {
    let level: Double
    let isActive: Bool
    @Environment(\.motion) private var motion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !isActive || !motion.allowsMovement)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0..<24, id: \.self) { index in
                    let wobble = motion.allowsMovement ? (sin(time * 9 + Double(index) * 0.7) + 1) / 2 : 0.5
                    let height = 4 + 18 * max(0.08, level * (0.45 + 0.55 * wobble))
                    Capsule()
                        .fill(index % 6 == 3 ? FLColor.accent : FLColor.textPrimary.opacity(0.7))
                        .frame(width: 3, height: isActive ? height : 4)
                }
            }
            .frame(height: 22)
        }
        .accessibilityHidden(true)
    }
}
