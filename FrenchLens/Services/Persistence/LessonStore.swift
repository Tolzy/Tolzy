import Foundation
import Observation
import OSLog

/// A saved item plus the lesson it came from.
struct LibraryEntry<Item: Hashable & Identifiable>: Identifiable, Hashable where Item.ID == String {
    var item: Item
    var lessonID: UUID

    var id: String { item.id }
}

/// Lessons on disk (Application Support/FrenchLens/lessons.json).
///
/// Small, synchronous and file-based on purpose: the prototype stores a
/// handful of lessons. Swap for SwiftData/SQLite without touching views.
@Observable
final class LessonStore {
    private(set) var lessons: [Lesson] = []
    private(set) var didSeedDemoLessons = false

    @ObservationIgnored let directory: URL
    private var fileURL: URL { directory.appendingPathComponent("lessons.json") }

    private struct Archive: Codable {
        var version = 1
        var lessons: [Lesson]
        var didSeedDemoLessons: Bool
    }

    init(directory: URL) {
        self.directory = directory
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        load()
    }

    static var defaultDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("FrenchLens", isDirectory: true)
    }

    // MARK: Queries

    var recent: [Lesson] { lessons.sorted { $0.createdAt > $1.createdAt } }
    var saved: [Lesson] { recent.filter(\.isSaved) }

    func lesson(id: UUID) -> Lesson? {
        lessons.first { $0.id == id }
    }

    var savedVocabulary: [LibraryEntry<VocabularyItem>] {
        unique(saved.flatMap { lesson in lesson.analysis.vocabulary.map { LibraryEntry(item: $0, lessonID: lesson.id) } })
    }

    var savedVerbs: [LibraryEntry<VerbAnalysis>] {
        unique(saved.flatMap { lesson in lesson.analysis.verbs.map { LibraryEntry(item: $0, lessonID: lesson.id) } })
    }

    var savedExpressions: [LibraryEntry<ExpressionItem>] {
        unique(saved.flatMap { lesson in lesson.analysis.expressions.map { LibraryEntry(item: $0, lessonID: lesson.id) } })
    }

    private func unique<Item>(_ entries: [LibraryEntry<Item>]) -> [LibraryEntry<Item>] {
        var seen = Set<String>()
        return entries.filter { seen.insert($0.id).inserted }
    }

    // MARK: Mutations

    func add(_ lesson: Lesson) {
        lessons.removeAll { $0.id == lesson.id }
        lessons.append(lesson)
        persist()
    }

    func setSaved(_ isSaved: Bool, lessonID: UUID) {
        guard let index = lessons.firstIndex(where: { $0.id == lessonID }) else { return }
        lessons[index].isSaved = isSaved
        persist()
    }

    func toggleSaved(lessonID: UUID) {
        guard let lesson = lesson(id: lessonID) else { return }
        setSaved(!lesson.isSaved, lessonID: lessonID)
    }

    func delete(lessonID: UUID) {
        lessons.removeAll { $0.id == lessonID }
        persist()
    }

    /// Clears everything. Demo lessons are not re-seeded afterwards, so the
    /// empty states can be seen.
    func removeAll() {
        lessons = []
        didSeedDemoLessons = true
        persist()
    }

    /// Adds the demo lessons once, on first launch, as recent history.
    func seedDemoLessonsIfNeeded(from library: DemoLibrary, now: Date = Date()) {
        guard !didSeedDemoLessons else { return }
        let ages: [TimeInterval] = [4 * 60, 2 * 3600, 26 * 3600]
        for (index, demo) in library.lessons.enumerated() {
            let age = index < ages.count ? ages[index] : TimeInterval(index) * 86_400
            lessons.append(demo.makeLesson(level: .a1, createdAt: now.addingTimeInterval(-age)))
        }
        didSeedDemoLessons = true
        persist()
    }

    // MARK: Disk

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        do {
            let archive = try Self.decoder.decode(Archive.self, from: data)
            lessons = archive.lessons
            didSeedDemoLessons = archive.didSeedDemoLessons
        } catch {
            Logger.app.error("Lesson archive unreadable: \(String(describing: error), privacy: .public)")
        }
    }

    private func persist() {
        do {
            let data = try Self.encoder.encode(Archive(lessons: lessons, didSeedDemoLessons: didSeedDemoLessons))
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            Logger.app.error("Could not save lessons: \(String(describing: error), privacy: .public)")
        }
    }

    // Default (floating-point) dates round-trip exactly.
    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()
}
