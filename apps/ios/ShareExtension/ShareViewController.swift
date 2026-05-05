import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    handleTextContent(provider: provider)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    handleURLContent(provider: provider)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    handleImageContent(provider: provider)
                }
            }
        }
    }

    private func handleTextContent(provider: NSItemProvider) {
        provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] item, _ in
            guard let text = item as? String else { return }
            self?.sendToCoreBlow(content: text, type: "text")
        }
    }

    private func handleURLContent(provider: NSItemProvider) {
        provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] item, _ in
            guard let url = item as? URL else { return }
            self?.sendToCoreBlow(content: url.absoluteString, type: "url")
        }
    }

    private func handleImageContent(provider: NSItemProvider) {
        provider.loadItem(forTypeIdentifier: UTType.image.identifier) { [weak self] item, _ in
            guard let url = item as? URL else { return }
            self?.sendToCoreBlow(content: url.path, type: "image")
        }
    }

    private func sendToCoreBlow(content: String, type: String) {
        let sharedDefaults = UserDefaults(suiteName: "group.com.coreblow.app")
        sharedDefaults?.set(content, forKey: "sharedContent")
        sharedDefaults?.set(type, forKey: "sharedContentType")
        sharedDefaults?.set(Date().timeIntervalSince1970, forKey: "sharedAt")

        DispatchQueue.main.async { [weak self] in
            self?.completeRequest()
        }
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
