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

/// How lessons are produced.
enum AnalysisMode: String, CaseIterable, Identifiable {
    /// Apple speech recognition + Apple Intelligence on the iPhone.
    case onDevice
    /// The FrenchLens backend (when configured).
    case backend
    /// Bundled sample lessons.
    case demo

    var id: String { rawValue }

    var title: String {
        switch self {
        case .onDevice: "On this iPhone"
        case .backend: "FrenchLens server"
        case .demo: "Sample lessons"
        }
    }
}

/// Learner preferences, persisted in `UserDefaults`.
@Observable
final class AppSettings {
    private enum Keys {
        static let level = "settings.level"
        static let analysisMode = "settings.analysisMode"
        static let appearance = "settings.appearance"
        static let learnerName = "settings.learnerName"
        static let namePronunciation = "settings.namePronunciation"
    }

    @ObservationIgnored private let defaults: UserDefaults

    private var storedLevel: CEFRLevel
    private var storedAnalysisMode: AnalysisMode
    private var storedAppearance: Appearance
    private var storedLearnerName: String
    private var storedNamePronunciation: String

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        storedLevel = defaults.string(forKey: Keys.level).flatMap(CEFRLevel.init(rawValue:)) ?? .a1
        storedAnalysisMode = defaults.string(forKey: Keys.analysisMode).flatMap(AnalysisMode.init(rawValue:)) ?? .onDevice
        storedAppearance = defaults.string(forKey: Keys.appearance).flatMap(Appearance.init(rawValue:)) ?? .dark
        storedLearnerName = defaults.string(forKey: Keys.learnerName) ?? ""
        storedNamePronunciation = defaults.string(forKey: Keys.namePronunciation) ?? ""
    }

    /// What Camille calls the learner. Also helps speech recognition hear it.
    var learnerName: String {
        get { storedLearnerName }
        set {
            storedLearnerName = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            defaults.set(storedLearnerName, forKey: Keys.learnerName)
        }
    }

    /// How the French voice should say the name (a respelling), or empty
    /// to use `ConversationFlow.frenchRespelling`.
    var namePronunciation: String {
        get { storedNamePronunciation }
        set {
            storedNamePronunciation = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            defaults.set(storedNamePronunciation, forKey: Keys.namePronunciation)
        }
    }

    /// The learner's name and how to say it, when they've given one.
    var learnerVoiceName: LearnerName? {
        guard !learnerName.isEmpty else { return nil }
        let spoken = namePronunciation.isEmpty ? ConversationFlow.frenchRespelling(of: learnerName) : namePronunciation
        return LearnerName(written: learnerName, spoken: spoken)
    }

    /// All explanations adapt to this level. Default: A1.
    var level: CEFRLevel {
        get { storedLevel }
        set {
            storedLevel = newValue
            defaults.set(newValue.rawValue, forKey: Keys.level)
        }
    }

    /// How lessons are produced. Default: on this iPhone.
    var analysisMode: AnalysisMode {
        get { storedAnalysisMode }
        set {
            storedAnalysisMode = newValue
            defaults.set(newValue.rawValue, forKey: Keys.analysisMode)
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
