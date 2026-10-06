import Foundation
import UniformTypeIdentifiers

/// Maps the type identifiers a host app registers to FrenchLens capabilities.
enum SupportedContent {
    /// The capability a single type identifier represents, if any.
    ///
    /// `public.file-url` deliberately returns `nil`: a file URL can point at a
    /// video, an image or anything else, so the parser inspects it after loading.
    static func capability(forTypeIdentifier identifier: String) -> SharedCapability? {
        guard let type = UTType(identifier) else { return nil }
        if type.conforms(to: .movie) { return .video }
        if type.conforms(to: .audio) { return .audio }
        if type.conforms(to: .fileURL) { return nil }
        if type.conforms(to: .url) { return .url }
        if type.conforms(to: .image) { return .image }
        if type.conforms(to: .text) { return .text }
        return nil
    }

    static func capabilities(forTypeIdentifiers identifiers: [String]) -> Set<SharedCapability> {
        Set(identifiers.compactMap(capability(forTypeIdentifier:)))
    }

    /// The best capability on offer, following the product priority.
    static func bestCapability(forTypeIdentifiers identifiers: [String]) -> SharedCapability? {
        capabilities(forTypeIdentifiers: identifiers).min()
    }

    static func isSupported(typeIdentifiers identifiers: [String]) -> Bool {
        !capabilities(forTypeIdentifiers: identifiers).isEmpty
            || identifiers.contains(UTType.fileURL.identifier)
    }

    /// The capability a local file represents, judged by its extension.
    static func capability(forFileURL url: URL) -> SharedCapability? {
        guard let type = UTType(filenameExtension: url.pathExtension) else { return nil }
        return capability(forTypeIdentifier: type.identifier)
    }
}
