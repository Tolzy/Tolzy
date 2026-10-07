import Foundation

/// Common European Framework of Reference level.
enum CEFRLevel: String, Codable, CaseIterable, Identifiable, Comparable {
    case a1 = "A1"
    case a2 = "A2"
    case b1 = "B1"
    case b2 = "B2"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .a1: "Beginner"
        case .a2: "Elementary"
        case .b1: "Intermediate"
        case .b2: "Upper intermediate"
        }
    }

    /// How FrenchLens explains things at this level.
    var explanationStyle: String {
        switch self {
        case .a1: "Simple English explanations."
        case .a2: "Simple explanations with extra examples."
        case .b1: "More nuance: register, alternatives and exceptions."
        case .b2: "French-first explanations with register and context."
        }
    }

    private var order: Int { Self.allCases.firstIndex(of: self) ?? 0 }

    static func < (lhs: CEFRLevel, rhs: CEFRLevel) -> Bool { lhs.order < rhs.order }
}

/// Text written once per CEFR level. Lower levels are required; higher levels
/// fall back to the closest lower level when absent.
struct LevelledText: Codable, Hashable {
    var a1: String
    var a2: String?
    var b1: String?
    var b2: String?

    init(a1: String, a2: String? = nil, b1: String? = nil, b2: String? = nil) {
        self.a1 = a1
        self.a2 = a2
        self.b1 = b1
        self.b2 = b2
    }

    /// Accepts either a plain string (same text for all levels) or an object.
    init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer().decode(String.self) {
            self.init(a1: single)
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            a1: try container.decode(String.self, forKey: .a1),
            a2: try container.decodeIfPresent(String.self, forKey: .a2),
            b1: try container.decodeIfPresent(String.self, forKey: .b1),
            b2: try container.decodeIfPresent(String.self, forKey: .b2)
        )
    }

    func text(for level: CEFRLevel) -> String {
        switch level {
        case .a1: a1
        case .a2: a2 ?? a1
        case .b1: b1 ?? a2 ?? a1
        case .b2: b2 ?? b1 ?? a2 ?? a1
        }
    }
}
