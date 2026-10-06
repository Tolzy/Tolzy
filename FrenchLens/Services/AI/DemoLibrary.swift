import Foundation
import OSLog

/// The bundled sample lessons used in Demo Mode.
struct DemoLibrary {
    let lessons: [DemoLesson]

    /// Display order: the spec's "J'en ai marre" first.
    static let preferredOrder = ["demo-en-avoir-marre", "demo-futur-proche", "demo-passe-compose"]
    static let resourceNames = ["demo_en_avoir_marre", "demo_futur_proche", "demo_passe_compose"]

    init(lessons: [DemoLesson]) {
        self.lessons = lessons.sorted { lhs, rhs in
            (Self.preferredOrder.firstIndex(of: lhs.id) ?? .max) < (Self.preferredOrder.firstIndex(of: rhs.id) ?? .max)
        }
    }

    static func load(from bundle: Bundle = .main) -> DemoLibrary {
        let decoder = JSONDecoder()
        var lessons: [DemoLesson] = []
        for name in resourceNames {
            guard let url = bundle.url(forResource: name, withExtension: "json") else {
                Logger.app.error("Missing demo lesson \(name, privacy: .public)")
                continue
            }
            do {
                lessons.append(try decoder.decode(DemoLesson.self, from: Data(contentsOf: url)))
            } catch {
                Logger.app.error("Could not decode demo lesson \(name, privacy: .public): \(String(describing: error), privacy: .public)")
            }
        }
        return DemoLibrary(lessons: lessons)
    }

    func lesson(id: String) -> DemoLesson? {
        lessons.first { $0.id == id }
    }

    /// The sample that best fits an input. Text is matched on keywords;
    /// media gets the futur proche lesson, which shows the most features.
    func bestMatch(for input: LessonInput) -> DemoLesson? {
        switch input {
        case .media:
            return lesson(id: "demo-futur-proche") ?? lessons.first
        case .text(let text):
            let haystack = text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "fr_FR"))
            let scored = lessons.map { lesson -> (DemoLesson, Int) in
                let score = lesson.keywords.filter { keyword in
                    haystack.contains(keyword.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "fr_FR")))
                }.count
                return (lesson, score)
            }
            return scored.max { $0.1 < $1.1 }.flatMap { $0.1 > 0 ? $0.0 : nil } ?? lessons.first
        }
    }
}

extension Logger {
    static let app = Logger(subsystem: Bundle.main.bundleIdentifier ?? "FrenchLens", category: "app")
}
