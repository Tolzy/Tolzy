import Foundation
import Observation

/// The state machine from "something was shared" to "a lesson is ready".
///
///     idle ──submit──▶ processing(stage…) ──▶ ready(lessonID) ──finish──▶ idle
///                            │
///                            └──────────────▶ failed(IngestError) ──dismiss/retry──▶ …
@MainActor
@Observable
final class IngestCoordinator {
    enum Phase: Equatable {
        case idle
        case processing(ProcessingStage)
        case ready(UUID)
        case failed(IngestError)
    }

    enum Request: Equatable {
        case payload(SharedPayload)
        /// A local video file (Photos upload fallback).
        case video(URL)
        case text(String)
        /// A link pasted by the learner.
        case link(String)
    }

    private(set) var phase: Phase = .idle
    /// A link received without media. Kept so an uploaded video can be
    /// attached to its original post.
    private(set) var pendingLink: URL?

    @ObservationIgnored private let store: LessonStore
    @ObservationIgnored private let media: MediaProcessing
    @ObservationIgnored private let inbox: ShareInbox?
    @ObservationIgnored private let makeAIService: () -> AIService
    @ObservationIgnored private let currentLevel: () -> CEFRLevel
    @ObservationIgnored private let resolver = ContentResolver()
    @ObservationIgnored private var lastRequest: Request?
    @ObservationIgnored private var task: Task<Void, Never>?

    init(
        store: LessonStore,
        media: MediaProcessing,
        inbox: ShareInbox?,
        makeAIService: @escaping () -> AIService,
        currentLevel: @escaping () -> CEFRLevel
    ) {
        self.store = store
        self.media = media
        self.inbox = inbox
        self.makeAIService = makeAIService
        self.currentLevel = currentLevel
    }

    /// Whether the processing / error screen should be on screen. It stays up
    /// through `.ready` so the completion moment can play before `finish()`.
    var isPresenting: Bool {
        phase != .idle
    }

    // MARK: Entry points

    /// Starts processing without waiting (for views).
    func submit(_ request: Request) {
        task?.cancel()
        task = Task { [weak self] in
            await self?.process(request)
        }
    }

    /// Processes the newest share waiting in the App Group inbox, if any.
    /// Called on launch and whenever the app becomes active.
    func processPendingShares() {
        guard phase == .idle, let inbox else { return }
        let pending = inbox.pendingPayloads()
        guard let newest = pending.last else { return }
        // Older, unprocessed shares are superseded by the newest one.
        pending.dropLast().forEach { inbox.remove(id: $0.id) }
        submit(.payload(newest))
    }

    func handle(_ link: DeepLink) {
        guard case .ingest(let id) = link, let inbox else { return }
        guard let payload = try? inbox.load(id: id) else { return }
        if case .processing = phase { return }
        submit(.payload(payload))
    }

    func retry() {
        guard let lastRequest else { return }
        submit(lastRequest)
    }

    /// Acknowledges a ready lesson (after navigating to it).
    func finish() {
        if case .ready = phase { phase = .idle }
    }

    /// Shows an error that happened outside the pipeline (e.g. in the picker).
    func present(_ error: IngestError) {
        task?.cancel()
        phase = .failed(error)
    }

    /// Cancels or closes the processing / error screen.
    func dismiss() {
        task?.cancel()
        task = nil
        phase = .idle
        pendingLink = nil
    }

    // MARK: Pipeline

    /// Runs a request to completion. `async` so tests can await the outcome.
    func process(_ request: Request) async {
        lastRequest = request
        phase = .processing(.receiving)

        switch request {
        case .payload(let payload):
            await process(payload)
        case .video(let url):
            await processMedia(at: url, link: pendingLink)
        case .text(let text):
            await processText(text)
        case .link(let string):
            guard let url = URLExtractor.firstURL(in: string) else {
                fail(.noURL)
                return
            }
            pendingLink = url
            fail(.linkOnly(url, caption: resolver.caption(from: [string])))
        }
    }

    private func process(_ payload: SharedPayload) async {
        defer { inbox?.remove(id: payload.id) }

        switch resolver.resolve(payload) {
        case .video(let video, let link):
            guard let inbox else { return fail(.processingFailed) }
            await processMedia(at: inbox.fileURL(named: video.fileName, in: payload.id), link: link)
        case .audio(let audio, let link):
            guard let inbox else { return fail(.processingFailed) }
            await processMedia(at: inbox.fileURL(named: audio.fileName, in: payload.id), link: link)
        case .link(let url, let caption):
            pendingLink = url
            fail(.linkOnly(url, caption: caption))
        case .text(let text):
            await processText(text)
        case .image:
            fail(.unsupportedContent("an image"))
        case .nothing:
            fail(.nothingShared)
        }
    }

    private func processMedia(at url: URL, link: URL?) async {
        guard await media.hasAudioTrack(at: url) else { return fail(.noAudio) }

        let storedName: String
        do {
            storedName = try media.storeMedia(at: url)
        } catch {
            return fail(.processingFailed)
        }
        let thumbnail = await media.makeThumbnail(forMediaNamed: storedName)
        let source = LessonSource(
            kind: link == nil ? .upload : LessonSource.kind(for: link),
            url: link,
            mediaFileName: storedName,
            thumbnailFileName: thumbnail
        )
        await build(from: .media(media.mediaURL(named: storedName)), source: source)
    }

    private func processText(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return fail(.nothingShared) }
        await build(from: .text(trimmed), source: LessonSource(kind: .text, url: pendingLink))
    }

    private func build(from input: LessonInput, source: LessonSource) async {
        let service = makeAIService()
        let level = currentLevel()
        do {
            let analysis = try await service.makeLesson(from: input, level: level) { [weak self] stage in
                Task { @MainActor in self?.advance(to: stage) }
            }
            try Task.checkCancellation()
            let lesson = Lesson(source: source, analysis: analysis, origin: service.origin, generatedForLevel: level)
            store.add(lesson)
            pendingLink = nil
            phase = .ready(lesson.id)
        } catch is CancellationError {
            phase = .idle
        } catch {
            fail(IngestError.from(error))
        }
    }

    private func advance(to stage: ProcessingStage) {
        // Late progress callbacks must never overwrite a final state.
        guard case .processing(let current) = phase, stage > current else { return }
        phase = .processing(stage)
    }

    private func fail(_ error: IngestError) {
        phase = .failed(error)
    }
}
