import Foundation

/// Finds and normalises web links in whatever a host app shared.
enum URLExtractor {
    /// Query parameters that only exist for tracking and never change the content.
    static let trackingParameters: Set<String> = [
        "igsh", "igshid", "utm_source", "utm_medium", "utm_campaign", "utm_term",
        "utm_content", "si", "feature", "_r", "_t", "is_from_webapp", "sender_device"
    ]

    /// All http(s) links in `text`, normalised and de-duplicated, in order.
    static func urls(in text: String) -> [URL] {
        var results: [URL] = []
        var seen = Set<String>()

        func append(_ url: URL) {
            let normalized = normalize(url)
            if seen.insert(normalized.absoluteString).inserted {
                results.append(normalized)
            }
        }

        if let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) {
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            for match in detector.matches(in: text, options: [], range: range) {
                if let url = match.url, isWebURL(url) { append(url) }
            }
        }

        // Fallback for environments where the detector finds nothing.
        if results.isEmpty {
            for word in text.split(whereSeparator: { $0.isWhitespace || $0 == "\"" || $0 == "<" || $0 == ">" }) {
                let candidate = String(word).trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?)("))
                if let url = URL(string: candidate), isWebURL(url), url.host != nil { append(url) }
            }
        }
        return results
    }

    static func firstURL(in text: String) -> URL? {
        urls(in: text).first
    }

    static func isWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }

    /// Lower-cases the host, drops fragments and tracking parameters.
    static func normalize(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        components.host = components.host?.lowercased()
        components.fragment = nil
        if let items = components.queryItems {
            let kept = items.filter { !trackingParameters.contains($0.name.lowercased()) }
            components.queryItems = kept.isEmpty ? nil : kept
        }
        return components.url ?? url
    }

    /// Interprets an item loaded from an `NSItemProvider` as a URL.
    /// Host apps variously hand over `URL`, `NSURL`, `String`, `Data` or attributed strings.
    static func url(fromLoadedItem item: Any?) -> URL? {
        switch item {
        case let url as URL:
            return url
        case let url as NSURL:
            return url as URL
        case let string as String:
            return url(fromString: string)
        case let attributed as NSAttributedString:
            return url(fromString: attributed.string)
        case let data as Data:
            if let url = URL(dataRepresentation: data, relativeTo: nil), url.scheme != nil { return url }
            return String(data: data, encoding: .utf8).flatMap { url(fromString: $0) }
        default:
            return nil
        }
    }

    private static func url(fromString string: String) -> URL? {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), url.scheme != nil, url.host != nil || url.isFileURL { return url }
        return firstURL(in: trimmed)
    }

    /// Interprets an item loaded from an `NSItemProvider` as text.
    static func text(fromLoadedItem item: Any?) -> String? {
        switch item {
        case let string as String: return string
        case let attributed as NSAttributedString: return attributed.string
        case let data as Data: return String(data: data, encoding: .utf8)
        case let url as URL: return url.absoluteString
        default: return nil
        }
    }
}
