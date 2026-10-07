import SwiftUI

/// Full-screen voice conversation: just the orb, live French captions, and
/// two buttons. Everything said also lands in the chat underneath.
struct VoiceModeView: View {
    @State private var session: VoiceSession
    @State private var hasAppeared = false
    @State private var speechPulse: Double = 0
    @AppStorage("voice.captions") private var showsCaptions = true

    @Environment(\.dismiss) private var dismiss
    @Environment(\.tts) private var tts
    @Environment(\.motion) private var motion

    init(controller: ConversationController, usesMicrophone: Bool) {
        _session = State(initialValue: VoiceSession(controller: controller, listener: SpeakInput(), usesMicrophone: usesMicrophone))
    }

    private var mood: VoiceOrb.Mood {
        switch session.phase {
        case .connecting, .failed: .resting
        case .listening: .listening
        case .thinking: .thinking
        case .speaking: .speaking
        case .muted: .muted
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            Spacer(minLength: FLSpacing.l)

            Button { session.tap() } label: {
                VoiceOrb(mood: mood, level: session.phase == .speaking ? speechPulse : session.inputLevel)
                    .scaleEffect(hasAppeared ? 1 : 0.06)
                    .opacity(hasAppeared ? 1 : 0.6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(statusText)
            .accessibilityHint(session.phase == .speaking ? "Stops Camille" : "Sends what you said")
            .accessibilityIdentifier("voice.orb")

            captions
                .frame(height: 150, alignment: .top)
                .padding(.top, FLSpacing.xl)
                .padding(.horizontal, FLSpacing.gutter)

            Spacer(minLength: FLSpacing.l)
            controls
        }
        .padding(.bottom, FLSpacing.m)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FLColor.background.ignoresSafeArea())
        .flHaptic(trigger: session.phase) { _, new in
            switch new {
            case .listening: FLHaptic.lookup
            case .thinking: FLHaptic.surface
            case .failed: FLHaptic.failure
            default: nil
            }
        }
        .onChange(of: tts.current?.range?.location) { _, location in
            // Each spoken word gives the orb a small beat.
            guard location != nil else { return }
            speechPulse = 0.9
            withAnimation(.easeOut(duration: 0.35)) { speechPulse = 0.25 }
        }
        .onAppear {
            session.controller.tts = tts
            if motion.allowsMovement {
                withAnimation(.spring(duration: 0.7, bounce: 0.3).delay(0.1)) { hasAppeared = true }
            } else {
                hasAppeared = true
            }
            session.start()
        }
        .onDisappear { session.end() }
        .statusBarHidden(false)
    }

    // MARK: Pieces

    private var statusText: String {
        switch session.phase {
        case .connecting: "Starting…"
        case .listening: "Listening"
        case .thinking: "Thinking"
        case .speaking: "Camille is speaking"
        case .muted: "Microphone off"
        case .failed: "Something went wrong"
        }
    }

    private var topBar: some View {
        HStack {
            Text(statusText)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FLColor.textSecondary)
                .contentTransition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: statusText)
                .accessibilityIdentifier("voice.status")
            Spacer()
            Button {
                showsCaptions.toggle()
            } label: {
                Image(systemName: showsCaptions ? "captions.bubble.fill" : "captions.bubble")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(FLColor.textPrimary)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(FLColor.surfaceElevated))
            }
            .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
            .accessibilityLabel(showsCaptions ? "Hide captions" : "Show captions")
        }
        .padding(.horizontal, FLSpacing.gutter)
        .padding(.top, FLSpacing.s)
    }

    @ViewBuilder
    private var captions: some View {
        if case .failed(let message) = session.phase {
            VStack(spacing: FLSpacing.s) {
                Text(message)
                    .font(.body)
                    .foregroundStyle(FLColor.textSecondary)
                    .multilineTextAlignment(.center)
                Button("Try again") { session.retry() }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(FLColor.accent)
            }
            .transition(.opacity)
        } else if showsCaptions {
            VStack(spacing: FLSpacing.xs) {
                Text(session.caption.isEmpty ? placeholder : session.caption)
                    .font(.system(.title3, weight: session.phase == .listening ? Font.Weight.regular : Font.Weight.semibold))
                    .foregroundStyle(session.caption.isEmpty ? FLColor.textTertiary : FLColor.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(4)
                    .minimumScaleFactor(0.8)
                    .contentTransition(.opacity)
                if !session.englishCaption.isEmpty {
                    Text(session.englishCaption)
                        .font(.subheadline)
                        .foregroundStyle(FLColor.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: session.caption)
            .animation(.easeInOut(duration: 0.25), value: session.phase)
            .accessibilityIdentifier("voice.caption")
        }
    }

    private var placeholder: String {
        switch session.phase {
        case .listening: "Parlez… (speak in French)"
        case .muted: "Tap the microphone to talk again"
        default: ""
        }
    }

    private var controls: some View {
        HStack(spacing: FLSpacing.l) {
            Button {
                session.toggleMute()
            } label: {
                Image(systemName: session.isMuted ? "mic.slash.fill" : "mic.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(session.isMuted ? FLColor.error : FLColor.textPrimary)
                    .contentTransition(.symbolEffect(.replace))
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(FLColor.surfaceElevated))
            }
            .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
            .accessibilityLabel(session.isMuted ? "Turn microphone on" : "Mute microphone")
            .accessibilityIdentifier("voice.mute")

            Button {
                session.end()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(FLColor.background)
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(FLColor.textPrimary))
            }
            .buttonStyle(FLPressableStyle(scale: 0.9, highlights: false))
            .accessibilityLabel("End voice conversation")
            .accessibilityIdentifier("voice.close")
        }
    }
}
