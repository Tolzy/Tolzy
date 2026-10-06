import SwiftUI
import UIKit

/// Principal class of the FrenchLens Share Extension.
///
/// It reads what the host app put on the Share Sheet (via `NSExtensionContext`
/// → `NSExtensionItem` → `NSItemProvider`), copies any media into the App Group
/// inbox, writes a `SharedPayload`, and hands off to the main app. It never
/// builds the lesson itself: extensions have tight memory and time limits.
final class ShareViewController: UIViewController {
    private let model = ShareExtensionModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        overrideUserInterfaceStyle = .dark

        let root = ShareExtensionView(
            model: model,
            onDone: { [weak self] in self?.complete() },
            onCancel: { [weak self] in self?.cancel() }
        )
        let host = UIHostingController(rootView: root)
        host.view.backgroundColor = .clear
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)

        let context = extensionContext
        Task { @MainActor [weak self] in
            await self?.model.receive(from: context)
        }
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    private func cancel() {
        model.discard()
        extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
    }
}
