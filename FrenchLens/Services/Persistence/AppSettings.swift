import Observation
import SwiftUI

enum Appearance: String, CaseIterable, Identifiable {
    case dark, light, system

    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    var colorScheme: ColorScheme? {
        switch self {
        case .dark: .dark
        case .light: .light
        case .system: nil
        }
    }
}

/// Learner preferences, persisted in `UserDefaults`.
@Observable
final class AppSettings {
    private enum Keys {
        static let level = "settings.level"
        static let demoMode = "settings.demoMode"
        static let appearance = "settings.appearance"
    }

    @ObservationIgnored private let defaults: UserDefaults

    private var storedLevel: CEFRLevel
    private var storedDemoMode: Bool
    private var storedAppearance: Appearance

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        storedLevel = defaults.string(forKey: Keys.level).flatMap(CEFRLevel.init(rawValue:)) ?? .a1
        storedDemoMode = defaults.object(forKey: Keys.demoMode) as? Bool ?? true
        storedAppearance = defaults.string(forKey: Keys.appearance).flatMap(Appearance.init(rawValue:)) ?? .dark
    }

    /// All explanations adapt to this level. Default: A1.
    var level: CEFRLevel {
        get { storedLevel }
        set {
            storedLevel = newValue
            defaults.set(newValue.rawValue, forKey: Keys.level)
        }
    }

    /// When on, lessons come from bundled samples instead of the backend.
    var demoModeEnabled: Bool {
        get { storedDemoMode }
        set {
            storedDemoMode = newValue
            defaults.set(newValue, forKey: Keys.demoMode)
        }
    }

    var appearance: Appearance {
        get { storedAppearance }
        set {
            storedAppearance = newValue
            defaults.set(newValue.rawValue, forKey: Keys.appearance)
        }
    }
}
