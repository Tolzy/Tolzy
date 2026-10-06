import Foundation

/// The learning layers below the transcript, revealed one at a time.
enum LessonSection: String, CaseIterable, Identifiable, Hashable {
    case vocabulary, verbs, expressions, grammar, pronunciation

    var id: String { rawValue }

    var title: String {
        switch self {
        case .vocabulary: "Vocabulary"
        case .verbs: "Verbs"
        case .expressions: "Expressions"
        case .grammar: "Grammar"
        case .pronunciation: "Pronunciation"
        }
    }

    /// Sections that actually have content for this lesson.
    static func available(in analysis: LessonAnalysis) -> [LessonSection] {
        allCases.filter { section in
            switch section {
            case .vocabulary: !analysis.vocabulary.isEmpty
            case .verbs: !analysis.verbs.isEmpty
            case .expressions: !analysis.expressions.isEmpty
            case .grammar: !analysis.grammar.isEmpty
            case .pronunciation: !analysis.pronunciation.isEmpty
            }
        }
    }
}
