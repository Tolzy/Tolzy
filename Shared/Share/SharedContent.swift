import Foundation

// MARK: - Capabilities
//
// The Share Sheet gives an extension whatever the host app chooses to provide.
// Instagram, TikTok, YouTube, Photos and Safari all behave differently, and the
// same app can change behaviour between versions. FrenchLens therefore never
// assumes a specific shape: everything that arrives is recorded as one of the
// capabilities below, and `ContentResolver` later picks the best one.

/// A kind of content the Share Sheet can hand to FrenchLens, in priority order.
enum SharedCapability: String, Codable, CaseIterable, Comparable {
    case video
    case audio
    case url
    case text
    case image

    /// Lower is better. Mirrors the product rule: video › audio › URL › text › image.
    var priority: Int {
        switch self {
        case .video: 0
        case .audio: 1
        case .url: 2
        case .text: 3
        case .image: 4
        }
    }

    static func < (lhs: SharedCapability, rhs: SharedCapability) -> Bool {
        lhs.priority < rhs.priority
    }
}

/// A video file copied out of the host app into the shared container.
struct SharedVideo: Codable, Hashable {
    /// File name inside the payload's directory in the App Group inbox.
    var fileName: String
    var typeIdentifier: String
    var suggestedName: String?
}

/// An audio file copied out of the host app into the shared container.
struct SharedAudio: Codable, Hashable {
    var fileName: String
    var typeIdentifier: String
    var suggestedName: String?
}

/// A web link. It is stored as provenance only: FrenchLens never downloads,
/// scrapes or resolves media behind a social link.
struct SharedURL: Codable, Hashable {
    var url: URL

    var platform: SourcePlatform { SourcePlatform(url: url) }
}

/// Plain text, e.g. a caption or a sentence copied from a web page.
struct SharedText: Codable, Hashable {
    var text: String
}

/// An image file copied into the shared container (e.g. a thumbnail or screenshot).
struct SharedImage: Codable, Hashable {
    var fileName: String
    var typeIdentifier: String
}

// MARK: - Payload

/// Everything one share produced. Written by the Share Extension to the App
/// Group inbox as JSON and read back by the main app.
struct SharedPayload: Codable, Hashable, Identifiable {
    var id: UUID
    var createdAt: Date
    var videos: [SharedVideo]
    var audio: [SharedAudio]
    var urls: [SharedURL]
    var texts: [SharedText]
    var images: [SharedImage]
    /// Every type identifier the host app registered, kept for diagnostics.
    var registeredTypeIdentifiers: [String]

    init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        videos: [SharedVideo] = [],
        audio: [SharedAudio] = [],
        urls: [SharedURL] = [],
        texts: [SharedText] = [],
        images: [SharedImage] = [],
        registeredTypeIdentifiers: [String] = []
    ) {
        self.id = id
        self.createdAt = createdAt
        self.videos = videos
        self.audio = audio
        self.urls = urls
        self.texts = texts
        self.images = images
        self.registeredTypeIdentifiers = registeredTypeIdentifiers
    }

    var capabilities: Set<SharedCapability> {
        var result = Set<SharedCapability>()
        if !videos.isEmpty { result.insert(.video) }
        if !audio.isEmpty { result.insert(.audio) }
        if !urls.isEmpty { result.insert(.url) }
        if texts.contains(where: { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
            result.insert(.text)
        }
        if !images.isEmpty { result.insert(.image) }
        return result
    }

    var isEmpty: Bool { capabilities.isEmpty }

    /// A short, human description of what arrived, e.g. "Video and link".
    var summary: String {
        let names = capabilities.sorted().map { capability -> String in
            switch capability {
            case .video: "video"
            case .audio: "audio"
            case .url: urls.first.map { $0.platform.mediaNoun(for: $0.url) + " link" } ?? "link"
            case .text: "text"
            case .image: "image"
            }
        }
        guard let first = names.first else { return "Nothing readable" }
        let rest = names.dropFirst()
        let head = first.prefix(1).uppercased() + first.dropFirst()
        if rest.isEmpty { return head }
        return head + " and " + rest.joined(separator: " and ")
    }
}
