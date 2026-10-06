import SwiftUI

/// The one prominent action on a screen. Accent fill, used sparingly.
struct PrimaryButton: View {
    let title: String
    var systemImage: String?
    let action: () -> Void

    init(_ title: String, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ButtonLabel(title: title, systemImage: systemImage)
        }
        .buttonStyle(FLButtonStyle(kind: .primary))
    }
}

/// A quiet, neutral action.
struct SecondaryButton: View {
    let title: String
    var systemImage: String?
    let action: () -> Void

    init(_ title: String, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ButtonLabel(title: title, systemImage: systemImage)
        }
        .buttonStyle(FLButtonStyle(kind: .secondary))
    }
}

/// Shared label so custom buttons (e.g. PhotosPicker) look identical.
struct ButtonLabel: View {
    let title: String
    var systemImage: String?

    var body: some View {
        HStack(spacing: FLSpacing.xs) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
            }
            Text(title)
                .font(.body.weight(.semibold))
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 54)
        .contentShape(Rectangle())
    }
}

struct FLButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, quiet }

    var kind: Kind
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(foreground)
            .background(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .fill(background(pressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: FLRadius.medium, style: .continuous)
                    .strokeBorder(kind == .secondary ? FLColor.separator : .clear, lineWidth: 0.5)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(isEnabled ? 1 : 0.4)
            .animation(FLMotion.snappy, value: configuration.isPressed)
    }

    private var foreground: Color {
        switch kind {
        case .primary: FLColor.textOnAccent
        case .secondary, .quiet: FLColor.textPrimary
        }
    }

    private func background(pressed: Bool) -> Color {
        switch kind {
        case .primary: pressed ? FLColor.accent.opacity(0.85) : FLColor.accent
        case .secondary: pressed ? FLColor.surfacePressed : FLColor.surfaceElevated
        case .quiet: pressed ? FLColor.surfaceElevated : .clear
        }
    }
}

/// Small circular icon button (close, play…).
struct IconButton: View {
    let systemImage: String
    let accessibilityLabel: String
    var size: CGFloat = 34
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(FLColor.textPrimary)
                .frame(width: size, height: size)
                .background(Circle().fill(FLColor.surfaceElevated))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}
