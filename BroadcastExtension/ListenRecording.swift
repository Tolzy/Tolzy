import AVFoundation
import CoreImage
import ReplayKit
import UniformTypeIdentifiers

/// Writes app audio to an AAC file in the App Group inbox and grabs one
/// downscaled frame as a poster. Memory-light: broadcast extensions are
/// limited to about 50 MB.
final class ListenRecording {
    let payloadID = UUID()
    private let inbox: ShareInbox
    private let directory: URL
    private let lock = NSLock()

    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var firstTime: CMTime?
    private var lastTime: CMTime = .zero
    private var posterSaved = false
    private var firstVideoTime: CMTime?
    private var wroteAudio = false
    private var isFinishing = false

    init(inbox: ShareInbox) throws {
        self.inbox = inbox
        directory = try inbox.makeDirectory(for: payloadID)
        let marker = ["startedAt": Date().timeIntervalSince1970]
        try? JSONSerialization.data(withJSONObject: marker)
            .write(to: inbox.rootURL.appendingPathComponent(ListenConstants.activeMarkerName))
    }

    var duration: Double {
        lock.lock(); defer { lock.unlock() }
        guard let firstTime else { return 0 }
        return CMTimeSubtract(lastTime, firstTime).seconds
    }

    func appendAudio(_ buffer: CMSampleBuffer) {
        lock.lock(); defer { lock.unlock() }
        guard !isFinishing, CMSampleBufferDataIsReady(buffer) else { return }
        if writer == nil { startWriter(matching: buffer) }
        guard let writer, let input, writer.status == .writing, input.isReadyForMoreMediaData else { return }
        if input.append(buffer) {
            wroteAudio = true
            lastTime = CMSampleBufferGetPresentationTimeStamp(buffer)
        }
    }

    private func startWriter(matching buffer: CMSampleBuffer) {
        guard let format = CMSampleBufferGetFormatDescription(buffer),
              let description = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee
        else { return }
        let channels = min(max(Int(description.mChannelsPerFrame), 1), 2)
        let sampleRate = description.mSampleRate > 0 ? description.mSampleRate : 44_100
        let url = directory.appendingPathComponent(ListenConstants.audioFileName)
        guard let writer = try? AVAssetWriter(outputURL: url, fileType: .m4a) else { return }
        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channels,
            AVEncoderBitRateKey: 96_000,
        ])
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { return }
        writer.add(input)
        let start = CMSampleBufferGetPresentationTimeStamp(buffer)
        guard writer.startWriting() else { return }
        writer.startSession(atSourceTime: start)
        self.writer = writer
        self.input = input
        firstTime = start
        lastTime = start
    }

    /// One frame, a second in, scaled to ~600 px tall.
    func capturePosterIfNeeded(_ buffer: CMSampleBuffer) {
        lock.lock()
        let shouldCapture: Bool
        let time = CMSampleBufferGetPresentationTimeStamp(buffer)
        if posterSaved {
            shouldCapture = false
        } else if let firstVideoTime {
            shouldCapture = CMTimeSubtract(time, firstVideoTime).seconds >= 1.5
        } else {
            firstVideoTime = time
            shouldCapture = false
        }
        if shouldCapture { posterSaved = true }
        lock.unlock()
        guard shouldCapture, let pixels = CMSampleBufferGetImageBuffer(buffer) else { return }

        autoreleasepool {
            let image = CIImage(cvPixelBuffer: pixels)
            let scale = 600 / max(image.extent.height, 1)
            let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
            let context = CIContext(options: [.cacheIntermediates: false])
            guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
                  let data = context.jpegRepresentation(of: scaled, colorSpace: colorSpace, options: [:])
            else { return }
            try? data.write(to: directory.appendingPathComponent(ListenConstants.posterFileName))
        }
    }

    /// Finalises the file and queues the payload. `nil` if nothing was heard.
    func finish() -> SharedPayload? {
        // No more appends once finishing starts; appending after
        // markAsFinished would raise.
        lock.lock()
        isFinishing = true
        let writer = self.writer
        let input = self.input
        let wroteAudio = self.wroteAudio
        if let input, let writer, writer.status == .writing, wroteAudio {
            input.markAsFinished()
        }
        lock.unlock()
        try? FileManager.default.removeItem(at: inbox.rootURL.appendingPathComponent(ListenConstants.activeMarkerName))

        guard let writer, input != nil, wroteAudio, writer.status == .writing else {
            writer?.cancelWriting()
            inbox.remove(id: payloadID)
            return nil
        }
        let semaphore = DispatchSemaphore(value: 0)
        writer.finishWriting { semaphore.signal() }
        _ = semaphore.wait(timeout: .now() + 5)
        guard writer.status == .completed else {
            inbox.remove(id: payloadID)
            return nil
        }

        let posterURL = directory.appendingPathComponent(ListenConstants.posterFileName)
        let hasPoster = FileManager.default.fileExists(atPath: posterURL.path)
        let payload = SharedPayload(
            id: payloadID,
            audio: [SharedAudio(
                fileName: ListenConstants.audioFileName,
                typeIdentifier: UTType.mpeg4Audio.identifier,
                suggestedName: "Listened"
            )],
            images: hasPoster ? [SharedImage(fileName: ListenConstants.posterFileName, typeIdentifier: UTType.jpeg.identifier)] : [],
            registeredTypeIdentifiers: ["frenchlens.listen"]
        )
        do {
            try inbox.save(payload)
            return payload
        } catch {
            inbox.remove(id: payloadID)
            return nil
        }
    }
}
