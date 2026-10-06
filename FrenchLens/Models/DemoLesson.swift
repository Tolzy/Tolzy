import Foundation

/// A bundled sample used in Demo Mode. Stored as JSON in Resources/DemoLessons.
struct DemoLesson: Codable, Hashable, Identifiable {
    var id: String
    var source: LessonSource
    var analysis: LessonAnalysis
    /// Phrases used to match shared text to this sample in Demo Mode.
    var keywords: [String]

    func makeLesson(level: CEFRLevel, createdAt: Date = Date(), source overrideSource: LessonSource? = nil) -> Lesson {
        Lesson(
            createdAt: createdAt,
            source: overrideSource ?? source,
            analysis: analysis,
            origin: .demo,
            generatedForLevel: level
        )
    }
}
