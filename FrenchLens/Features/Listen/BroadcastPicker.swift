import ReplayKit
import SwiftUI

/// Opens iOS's "Start Broadcast" sheet for the FrenchLens broadcast
/// extension from our own button. The system picker view must be in the
/// hierarchy; it stays invisible and is triggered programmatically.
final class BroadcastTrigger {
    fileprivate weak var picker: RPSystemBroadcastPickerView?

    static var extensionBundleID: String {
        (Bundle.main.bundleIdentifier ?? "") + ListenConstants.extensionSuffix
    }

    func open() {
        guard let picker else { return }
        if let button = Self.findButton(in: picker) {
            button.sendActions(for: .touchUpInside)
        }
    }

    private static func findButton(in view: UIView) -> UIButton? {
        for subview in view.subviews {
            if let button = subview as? UIButton { return button }
            if let nested = findButton(in: subview) { return nested }
        }
        return nil
    }
}

struct BroadcastPickerHost: UIViewRepresentable {
    let trigger: BroadcastTrigger

    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
        picker.preferredExtension = BroadcastTrigger.extensionBundleID
        picker.showsMicrophoneButton = false
        trigger.picker = picker
        return picker
    }

    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {
        trigger.picker = uiView
    }
}
