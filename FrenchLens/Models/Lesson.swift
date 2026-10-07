import Foundation

/// Where a lesson's content came from.
struct LessonSource: Codable, Hashable {
    enum Kind: String, Codable {
        case instagramReel, tiktok, youtubeShort, webVideo, upload, text, demo
        /// Captured with "Listen while you watch" (audio only).
        case listened
    }

    var kind: Kind
    /// The original post URL, kept as provenance only.
    var url: URL?
    /// Media file name inside the app's media directory.
    var mediaFileName: String?
    /// Thumbnail file name inside the app's media directory.
    var thumbnailFileName: String?
    /// e.g. "@marie.cuisine". Purely descriptive.
    var author: String?

    /// Whether the stored media has pictures (vs. listened audio).
    var hasVideo: Bool {
        guard let mediaFileName else { return false }
        let audioExtensions: Set<String> = ["m4a", "mp3", "aac", "wav", "caf", "aiff"]
        return !audioExtensions.contains((mediaFileName as NSString).pathExtension.lowercased())
    }

    var label: String {
        switch kind {
        case .instagramReel: "French Reel"
        case .tiktok: "French TikTok"
        case .youtubeShort: "French Short"
        case .webVideo: "French video"
        case .upload: "Your video"
        case .text: "French text"
        case .demo: "Demo"
        case .listened: "Listened"
        }
    }

    var systemImage: String {
        switch kind {
        case .instagramReel, .tiktok, .youtubeShort: "play.rectangle"
        case .webVideo: "globe"
        case .upload: "film"
        case .text: "text.quote"
        case .demo: "sparkle"
        case .listened: "waveform"
        }
    }

    static func kind(for url: URL?) -> Kind {
        guard let url else { return .upload }
        switch SourcePlatform(url: url) {
        case .instagram: return .instagramReel
        case .tiktok: return .tiktok
        case .youtube: return .youtubeShort
        default: return .webVideo
        }
    }
}

/// How an analysis was produced. Demo analyses are labelled in the UI so a
/// sample is never presented as an analysis of the learner's own video.
enum AnalysisOrigin: String, Codable {
    case demo
    /// Apple speech recognition + Apple Intelligence, on the iPhone.
    case onDevice
    case backend
}

struct Lesson: Codable, Hashable, Identifiable {
    var id: UUID
    var createdAt: Date
    var source: LessonSource
    var analysis: LessonAnalysis
    var origin: AnalysisOrigin
    var isSaved: Bool
    /// The level the learner had selected when this lesson was generated.
    var generatedForLevel: CEFRLevel

    init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        source: LessonSource,
        analysis: LessonAnalysis,
        origin: AnalysisOrigin,
        isSaved: Bool = false,
        generatedForLevel: CEFRLevel = .a1
    ) {
        self.id = id
        self.createdAt = createdAt
        self.source = source
        self.analysis = analysis
        self.origin = origin
        self.isSaved = isSaved
        self.generatedForLevel = generatedForLevel
    }

    /// The first sentence, shortened for lists: "J'en ai marre de travailler…"
    var previewLine: String {
        let first = analysis.transcript.segments.first?.text ?? analysis.title
        let words = first.split(separator: " ")
        guard words.count > 5 else { return first }
        let head = words.prefix(5).joined(separator: " ")
            .trimmingCharacters(in: CharacterSet(charactersIn: ",.;:!?"))
        return head + "…"
    }
}
