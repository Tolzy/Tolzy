import Foundation

/// Where a shared link points. Used for labels and honest error copy only.
enum SourcePlatform: String, Codable, CaseIterable {
    case instagram
    case tiktok
    case youtube
    case x
    case facebook
    case web

    init(url: URL) {
        let host = (url.host ?? "").lowercased()
        func matches(_ domains: String...) -> Bool {
            domains.contains { host == $0 || host.hasSuffix("." + $0) }
        }
        if matches("instagram.com", "instagr.am") {
            self = .instagram
        } else if matches("tiktok.com") {
            self = .tiktok
        } else if matches("youtube.com", "youtu.be") {
            self = .youtube
        } else if matches("x.com", "twitter.com") {
            self = .x
        } else if matches("facebook.com", "fb.watch") {
            self = .facebook
        } else {
            self = .web
        }
    }

    var displayName: String {
        switch self {
        case .instagram: "Instagram"
        case .tiktok: "TikTok"
        case .youtube: "YouTube"
        case .x: "X"
        case .facebook: "Facebook"
        case .web: "Web"
        }
    }

    /// The word people use for a piece of content on this platform.
    func mediaNoun(for url: URL) -> String {
        let path = url.path.lowercased()
        switch self {
        case .instagram: return path.contains("/reel") ? "Reel" : "post"
        case .tiktok: return "TikTok"
        case .youtube: return path.contains("/shorts") ? "Short" : "video"
        default: return "video"
        }
    }
}
