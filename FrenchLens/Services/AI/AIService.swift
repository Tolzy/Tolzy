import Foundation

/// Steps shown while a lesson is being built.
enum ProcessingStage: Int, CaseIterable, Comparable {
    case receiving
    case extractingAudio
    case transcribing
    case analyzing
    case buildingLesson

    var title: String {
        switch self {
        case .receiving: "Reading what you shared"
        case .extractingAudio: "Listening to the audio"
        case .transcribing: "Writing down the French"
        case .analyzing: "Finding what's worth learning"
        case .buildingLesson: "Building your lesson"
        }
    }

    /// 0…1, for determinate progress.
    var progress: Double {
        Double(rawValue + 1) / Double(Self.allCases.count)
    }

    static func < (lhs: ProcessingStage, rhs: ProcessingStage) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// What the AI layer is asked to learn from.
enum LessonInput: Equatable {
    /// A local audio or video file.
    case media(URL)
    /// French text (e.g. a caption).
    case text(String)
}

/// The single entry point the app uses to turn content into a lesson.
///
/// Implementations compose transcription, translation and language analysis.
/// Nothing in the UI knows which provider (or the demo) is behind it.
protocol AIService {
    var origin: AnalysisOrigin { get }

    func makeLesson(
        from input: LessonInput,
        level: CEFRLevel,
        progress: @escaping @Sendable (ProcessingStage) -> Void
    ) async throws -> LessonAnalysis
}

enum AIServiceError: Error, Equatable {
    case notConfigured
    case emptyTranscript
    case invalidResponse
}
