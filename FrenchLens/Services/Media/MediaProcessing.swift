import Foundation

enum MediaError: Error, Equatable {
    case noAudioTrack
    case unreadable
    case exportFailed
}

/// Media operations the ingestion pipeline depends on. Abstracted for tests.
protocol MediaProcessing {
    func hasAudioTrack(at url: URL) async -> Bool
    /// Copies media into the app's library and returns its file name.
    func storeMedia(at url: URL) throws -> String
    func mediaURL(named name: String) -> URL
    /// Writes a JPEG poster frame and returns its file name.
    func makeThumbnail(forMediaNamed name: String) async -> String?
    /// Exports the audio track to an `.m4a` file for transcription.
    func extractAudio(from url: URL) async throws -> URL
}
