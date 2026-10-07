import Foundation

/// Demo Mode: walks through the real pipeline stages and returns a bundled
/// sample analysis. Lessons it produces are marked `.demo` and labelled in the
/// UI, so a sample is never mistaken for an analysis of the learner's video.
struct DemoAIService: AIService {
    let library: DemoLibrary
    var stepDelay: Duration = .milliseconds(650)

    var origin: AnalysisOrigin { .demo }

    func makeLesson(
        from input: LessonInput,
        level: CEFRLevel,
        progress: @escaping @Sendable (ProcessingStage) -> Void
    ) async throws -> LessonAnalysis {
        let stages: [ProcessingStage]
        switch input {
        case .media: stages = [.extractingAudio, .transcribing, .analyzing, .buildingLesson]
        case .text: stages = [.analyzing, .buildingLesson]
        }
        for stage in stages {
            progress(stage)
            try await Task.sleep(for: stepDelay)
        }
        guard let lesson = library.bestMatch(for: input) else { throw AIServiceError.invalidResponse }
        return lesson.analysis
    }
}
