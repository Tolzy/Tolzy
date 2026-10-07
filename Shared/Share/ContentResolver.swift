import Foundation

/// The single input FrenchLens will learn from, chosen from everything shared.
enum ResolvedInput: Equatable {
    /// A video file. `link` keeps the original post URL when it was also shared.
    case video(SharedVideo, link: URL?)
    case audio(SharedAudio, link: URL?)
    /// Only a link arrived. FrenchLens cannot fetch the media behind it.
    /// `caption` is any accompanying text with the link removed.
    case link(URL, caption: String?)
    case text(String)
    case image(SharedImage, link: URL?)
    case nothing

    var capability: SharedCapability? {
        switch self {
        case .video: .video
        case .audio: .audio
        case .link: .url
        case .text: .text
        case .image: .image
        case .nothing: nil
        }
    }

    var link: URL? {
        switch self {
        case .video(_, let link), .audio(_, let link), .image(_, let link): link
        case .link(let url, _): url
        case .text, .nothing: nil
        }
    }
}

/// Chooses the best available input: video › audio › URL › text › image.
///
/// The resolver never upgrades a link into media. If a host app only provided
/// a URL, the result is `.link` and the UI asks the learner for the video.
struct ContentResolver {
    func resolve(_ payload: SharedPayload) -> ResolvedInput {
        let texts = payload.texts
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let link = payload.urls.first?.url ?? texts.lazy.compactMap(URLExtractor.firstURL(in:)).first

        if let video = payload.videos.first { return .video(video, link: link) }
        if let audio = payload.audio.first { return .audio(audio, link: link) }
        if let link { return .link(link, caption: caption(from: texts)) }
        if let text = texts.first { return .text(text) }
        if let image = payload.images.first { return .image(image, link: nil) }
        return .nothing
    }

    /// Text with any links stripped; `nil` when nothing meaningful remains.
    func caption(from texts: [String]) -> String? {
        for text in texts {
            let stripped = text
                .split(whereSeparator: \.isWhitespace)
                .filter { URLExtractor.firstURL(in: String($0)) == nil }
                .joined(separator: " ")
            let letters = stripped.unicodeScalars.filter { CharacterSet.letters.contains($0) }.count
            if letters >= 8 { return stripped }
        }
        return nil
    }
}
