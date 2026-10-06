import PhotosUI
import SwiftUI

/// Upload fallback: pick a video from Photos. This guarantees the full
/// learning flow can run even when a social app only shares a link.
struct AddVideoButton<Label: View>: View {
    let onPicked: (URL) -> Void
    var onFailure: (IngestError) -> Void = { _ in }
    @ViewBuilder let label: () -> Label

    @State private var item: PhotosPickerItem?
    @State private var isLoading = false

    var body: some View {
        PhotosPicker(selection: $item, matching: .videos, preferredItemEncoding: .current, photoLibrary: .shared()) {
            label()
                .overlay(alignment: .trailing) {
                    if isLoading {
                        ProgressView().padding(.trailing, FLSpacing.m)
                    }
                }
        }
        .accessibilityIdentifier("addVideoButton")
        .onChange(of: item) { _, newItem in
            guard let newItem else { return }
            isLoading = true
            Task {
                defer {
                    isLoading = false
                    item = nil
                }
                do {
                    if let movie = try await newItem.loadTransferable(type: PickedMovie.self) {
                        onPicked(movie.url)
                    } else {
                        onFailure(.noVideo)
                    }
                } catch {
                    onFailure(.processingFailed)
                }
            }
        }
    }
}
