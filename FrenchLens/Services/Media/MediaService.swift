import AVFoundation
import UIKit

/// AVFoundation-backed media handling. Files live in Application Support/Media.
final class MediaService: MediaProcessing {
    let directory: URL
    private let fileManager = FileManager.default

    init(directory: URL) {
        self.directory = directory
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func hasAudioTrack(at url: URL) async -> Bool {
        let asset = AVURLAsset(url: url)
        let tracks = (try? await asset.loadTracks(withMediaType: .audio)) ?? []
        return !tracks.isEmpty
    }

    func storeMedia(at url: URL) throws -> String {
        let ext = url.pathExtension.isEmpty ? "mov" : url.pathExtension
        let name = "\(UUID().uuidString).\(ext)"
        do {
            try fileManager.copyItem(at: url, to: mediaURL(named: name))
        } catch {
            throw MediaError.unreadable
        }
        return name
    }

    func mediaURL(named name: String) -> URL {
        directory.appendingPathComponent(name)
    }

    func makeThumbnail(forMediaNamed name: String) async -> String? {
        let asset = AVURLAsset(url: mediaURL(named: name))
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 720, height: 720)
        do {
            let (cgImage, _) = try await generator.image(at: CMTime(seconds: 0.5, preferredTimescale: 600))
            guard let data = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.8) else { return nil }
            let thumbnailName = (name as NSString).deletingPathExtension + "-poster.jpg"
            try data.write(to: mediaURL(named: thumbnailName), options: .atomic)
            return thumbnailName
        } catch {
            return nil
        }
    }

    func extractAudio(from url: URL) async throws -> URL {
        let asset = AVURLAsset(url: url)
        guard await hasAudioTrack(at: url) else { throw MediaError.noAudioTrack }
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
            throw MediaError.exportFailed
        }
        let output = fileManager.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).m4a")
        session.outputURL = output
        session.outputFileType = .m4a
        await session.export()
        guard session.status == .completed else { throw MediaError.exportFailed }
        return output
    }

    func removeAll() {
        try? fileManager.removeItem(at: directory)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }
}
