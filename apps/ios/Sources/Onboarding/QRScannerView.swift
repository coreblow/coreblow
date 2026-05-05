import SwiftUI
#if canImport(VisionKit)
import VisionKit
#endif

/// QR code scanner using VisionKit's DataScannerViewController.
struct QRScannerView: UIViewControllerRepresentable {
    let onCodeScanned: (String) -> Void

    #if canImport(VisionKit)
    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCodeScanned: onCodeScanned)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onCodeScanned: (String) -> Void
        private var scanned = false

        init(onCodeScanned: @escaping (String) -> Void) {
            self.onCodeScanned = onCodeScanned
        }

        func dataScanner(
            _ scanner: DataScannerViewController,
            didTapOn item: RecognizedItem
        ) {
            guard !scanned else { return }
            if case .barcode(let barcode) = item,
               let value = barcode.payloadStringValue {
                scanned = true
                scanner.stopScanning()
                onCodeScanned(value)
            }
        }
    }
    #endif
}
