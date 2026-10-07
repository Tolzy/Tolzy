import Foundation
import UniformTypeIdentifiers

/// Turns the raw `NSItemProvider`s from a share into a `SharedPayload`.
///
/// Every capability that is actually present is preserved (a Reel shared with
/// both a video and its link keeps both). Media files are copied into
/// `directory`, which lives in the App Group inbox.
struct ShareItemParser {
    let payloadID: UUID
    let directory: URL

    func parse(providers: [ItemProviding], contentTexts: [String] = []) async -> SharedPayload {
        var payload = SharedPayload(id: payloadID)
        var seenURLs = Set<String>()

        func addURL(_ url: URL) {
            let normalized = URLExtractor.normalize(url)
            if seenURLs.insert(normalized.absoluteString).inserted {
                payload.urls.append(SharedURL(url: normalized))
            }
        }

        func addText(_ text: String) {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            URLExtractor.urls(in: trimmed).forEach(addURL)
            // A text item that is nothing but a link adds no extra meaning.
            if let only = URL(string: trimmed), URLExtractor.isWebURL(only) { return }
            if !payload.texts.contains(where: { $0.text == trimmed }) {
                payload.texts.append(SharedText(text: trimmed))
            }
        }

        for provider in providers {
            payload.registeredTypeIdentifiers.append(contentsOf: provider.registeredTypeIdentifiers)

            let mediaCountBefore = payload.videos.count + payload.audio.count + payload.images.count

            // 1–2. Media files (video, then audio, then image) – one per provider.
            if provider.hasItemConforming(to: .movie) {
                if let file = try? await provider.copyFile(of: .movie, into: directory) {
                    payload.videos.append(SharedVideo(
                        fileName: file.lastPathComponent,
                        typeIdentifier: identifier(of: provider, conformingTo: .movie),
                        suggestedName: provider.suggestedName
                    ))
                }
            } else if provider.hasItemConforming(to: .audio) {
                if let file = try? await provider.copyFile(of: .audio, into: directory) {
                    payload.audio.append(SharedAudio(
                        fileName: file.lastPathComponent,
                        typeIdentifier: identifier(of: provider, conformingTo: .audio),
                        suggestedName: provider.suggestedName
                    ))
                }
            } else if provider.hasItemConforming(to: .image) {
                if let file = try? await provider.copyFile(of: .image, into: directory) {
                    payload.images.append(SharedImage(
                        fileName: file.lastPathComponent,
                        typeIdentifier: identifier(of: provider, conformingTo: .image)
                    ))
                }
            }

            // 3. Links. File URLs are inspected and copied if they hold media.
            if provider.hasItemConforming(to: .url),
               let item = try? await provider.loadValue(of: .url),
               let url = URLExtractor.url(fromLoadedItem: item) {
                if url.isFileURL {
                    // Skip if this provider's media was already copied above.
                    let mediaCountAfter = payload.videos.count + payload.audio.count + payload.images.count
                    if mediaCountAfter == mediaCountBefore { importFile(at: url, into: &payload) }
                } else if URLExtractor.isWebURL(url) {
                    addURL(url)
                }
            }

            // 4. Text (captions often carry the link too).
            if provider.hasItemConforming(to: .plainText),
               let item = try? await provider.loadValue(of: .plainText),
               let text = URLExtractor.text(fromLoadedItem: item) {
                addText(text)
            }
        }

        contentTexts.forEach(addText)
        var seenTypes = Set<String>()
        payload.registeredTypeIdentifiers = payload.registeredTypeIdentifiers.filter { seenTypes.insert($0).inserted }
        return payload
    }

    /// Handles providers that only expose a `file://` URL (e.g. Files app).
    private func importFile(at url: URL, into payload: inout SharedPayload) {
        guard let capability = SupportedContent.capability(forFileURL: url) else { return }
        let type = UTType(filenameExtension: url.pathExtension)?.identifier ?? UTType.data.identifier
        switch capability {
        case .video:
            guard let copy = try? SharedFiles.copy(url, into: directory) else { return }
            payload.videos.append(SharedVideo(fileName: copy.lastPathComponent, typeIdentifier: type, suggestedName: url.lastPathComponent))
        case .audio:
            guard let copy = try? SharedFiles.copy(url, into: directory) else { return }
            payload.audio.append(SharedAudio(fileName: copy.lastPathComponent, typeIdentifier: type, suggestedName: url.lastPathComponent))
        case .image:
            guard let copy = try? SharedFiles.copy(url, into: directory) else { return }
            payload.images.append(SharedImage(fileName: copy.lastPathComponent, typeIdentifier: type))
        case .url, .text:
            return
        }
    }

    /// The most specific registered identifier conforming to `type`.
    private func identifier(of provider: ItemProviding, conformingTo type: UTType) -> String {
        provider.registeredTypeIdentifiers.first { UTType($0)?.conforms(to: type) == true } ?? type.identifier
    }
}
