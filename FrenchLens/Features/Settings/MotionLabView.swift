import SwiftUI

/// A living reference for the motion system: every intent and primitive,
/// playable in place. It doubles as the spec when mapping motion to Figma.
struct MotionLabView: View {
    @Environment(\.motion) private var motion
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var tokenPositions: [MotionToken: Bool] = [:]
    @State private var showsReveal = true
    @State private var showsPanel = false
    @State private var swapIndex = 0
    @State private var popCount = 0
    @State private var shakeCount = 0
    @State private var checkmarkID = UUID()
    @State private var selectedWord = 0
    @Namespace private var wordSelection

    private let words = ["Je", "vais", "vous", "montrer"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FLSpacing.xxl) {
                header

                section("Intents", detail: "Screens ask for an intent; the system picks the curve.") {
                    VStack(spacing: FLSpacing.s) {
                        ForEach(MotionToken.allCases) { token in
                            tokenRow(token)
                        }
                    }
                }

                section("Transitions", detail: "Reveal · Panel · Swap. Each falls back to a cross-fade.") {
                    VStack(alignment: .leading, spacing: FLSpacing.m) {
                        HStack {
                            SecondaryButton("Reveal") { motion.perform(.reveal) { showsReveal.toggle() } }
                            SecondaryButton("Panel") { motion.perform(.panel) { showsPanel.toggle() } }
                            SecondaryButton("Swap") { motion.perform(.swap) { swapIndex += 1 } }
                        }
                        ZStack {
                            if showsReveal {
                                Text("Je vais vous montrer…")
                                    .flTextStyle(.french)
                                    .transition(.flReveal)
                            }
                        }
                        .frame(height: 44, alignment: .leading)
                        ZStack {
                            Text(["préparer", "to prepare", "je prépare"][swapIndex % 3])
                                .flTextStyle(.title)
                                .id(swapIndex)
                                .transition(.flSwap)
                        }
                        .frame(height: 36, alignment: .leading)
                    }
                }

                section("Matched geometry", detail: "The highlight travels between words.") {
                    HStack(spacing: 7) {
                        ForEach(words.indices, id: \.self) { index in
                            Text(words[index])
                                .flTextStyle(.french)
                                .foregroundStyle(index == selectedWord ? FLColor.textOnAccent : FLColor.textPrimary)
                                .padding(.horizontal, 3)
                                .background {
                                    if index == selectedWord {
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(FLColor.accent)
                                            .flMatchedGeometry(id: "lab-word", in: wordSelection)
                                    }
                                }
                                .onTapGesture { motion.perform(.select) { selectedWord = index } }
                        }
                    }
                    .flHaptic(.lookup, trigger: selectedWord)
                }

                section("Keyframes & phases", detail: "Pop for acknowledgement, shake for “not quite”, the lens while working.") {
                    HStack(spacing: FLSpacing.xl) {
                        Button { popCount += 1 } label: {
                            Image(systemName: "bookmark.fill")
                                .font(.title2)
                                .foregroundStyle(FLColor.accent)
                                .flPop(trigger: popCount, tilt: -8)
                        }
                        .flHaptic(.saved, trigger: popCount)

                        Button { shakeCount += 1 } label: {
                            Image(systemName: "xmark")
                                .font(.title2)
                                .foregroundStyle(FLColor.error)
                                .flShake(trigger: shakeCount)
                        }
                        .flHaptic(.failure, trigger: shakeCount)

                        LensPulse(size: 36)

                        Button { checkmarkID = UUID() } label: {
                            DrawnCheckmark(size: 36).id(checkmarkID)
                        }
                    }
                    .buttonStyle(.plain)
                }

                section("Scroll", detail: "Rows soften as they leave the viewport.") {
                    VStack(spacing: 0) {
                        ForEach(0..<6, id: \.self) { index in
                            Text("Ligne \(index + 1)")
                                .flTextStyle(.headline)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, FLSpacing.m)
                                .overlay(alignment: .bottom) { Hairline() }
                                .flScrollFocus()
                        }
                    }
                }
            }
            .padding(FLSpacing.gutter)
            .padding(.bottom, 160)
        }
        .flSoftTopEdge()
        .accessibilityIdentifier("motionLab")
        .background(FLColor.background.ignoresSafeArea())
        .overlay(alignment: .bottom) {
            if showsPanel {
                ToastBanner(message: "A floating panel", systemImage: "rectangle.bottomhalf.inset.filled")
                    .padding(.bottom, FLSpacing.l)
                    .transition(.flPanel)
                    .onTapGesture { motion.perform(.panel) { showsPanel = false } }
            }
        }
        .navigationTitle("Motion")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FLSpacing.xs) {
            Text("Motion")
                .flTextStyle(.display)
                .foregroundStyle(FLColor.textPrimary)
            Text(reduceMotion
                 ? "Reduce Motion is on: movement becomes cross-fades and ambient loops pause."
                 : "Quiet, spring-based, intentional. Turn on Reduce Motion to see every effect degrade gracefully.")
                .flTextStyle(.body)
                .foregroundStyle(FLColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .flAppear(0)
    }

    private func section<Content: View>(_ title: String, detail: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: FLSpacing.m) {
            SectionHeader(title)
            Text(detail)
                .font(.footnote)
                .foregroundStyle(FLColor.textTertiary)
            content()
        }
    }

    private func tokenRow(_ token: MotionToken) -> some View {
        let isEnd = tokenPositions[token] ?? false
        return Button {
            motion.perform(token) { tokenPositions[token] = !isEnd }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(token.rawValue)
                        .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                        .foregroundStyle(FLColor.textPrimary)
                    Spacer()
                    Text(token.summary)
                        .font(.footnote)
                        .foregroundStyle(FLColor.textTertiary)
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(FLColor.hairline).frame(height: 2)
                        Circle()
                            .fill(FLColor.accent)
                            .frame(width: 12, height: 12)
                            .offset(x: isEnd ? proxy.size.width - 12 : 0)
                    }
                    .frame(maxHeight: .infinity)
                }
                .frame(height: 14)
            }
            .padding(.vertical, FLSpacing.xs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.flPressable)
        .accessibilityLabel("\(token.rawValue): \(token.summary). Play")
    }
}
