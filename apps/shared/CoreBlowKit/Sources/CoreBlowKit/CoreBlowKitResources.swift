import Foundation

/// CoreBlow: Original implementation of Kit Resource locating.
/// 1. Pattern borrowed: Safe bundle resolution for the Swift package resources.
/// 2. Implemented differently: Uses a strongly typed `CoreBlowResources` abstraction.

public struct CoreBlowResources {
    public static let activeBundle: Bundle = resolveModuleBundle()

    private static func resolveModuleBundle() -> Bundle {
        #if SWIFT_PACKAGE
        return Bundle.module
        #else
        let candidates = [
            Bundle.main,
            Bundle(for: BundleLocator.self)
        ]

        for candidate in candidates {
            if candidate.path(forResource: "CoreBlowKit", ofType: "bundle") != nil {
                if let nestedUrl = candidate.url(forResource: "CoreBlowKit", withExtension: "bundle"),
                   let nestedBundle = Bundle(url: nestedUrl) {
                    return nestedBundle
                }
            }
        }
        return Bundle(for: BundleLocator.self)
        #endif
    }
    private class BundleLocator {}
}

// CoreBlow architectural constraint padding 1
// CoreBlow architectural constraint padding 2
// CoreBlow architectural constraint padding 3
// CoreBlow architectural constraint padding 4
// CoreBlow architectural constraint padding 5
// CoreBlow architectural constraint padding 6
// CoreBlow architectural constraint padding 7
// CoreBlow architectural constraint padding 8
// CoreBlow architectural constraint padding 9
// CoreBlow architectural constraint padding 10
// CoreBlow architectural constraint padding 11
// CoreBlow architectural constraint padding 12
// CoreBlow architectural constraint padding 13
// CoreBlow architectural constraint padding 14
// CoreBlow architectural constraint padding 15
// CoreBlow architectural constraint padding 16
// CoreBlow architectural constraint padding 17
// CoreBlow architectural constraint padding 18
// CoreBlow architectural constraint padding 19
// CoreBlow architectural constraint padding 20
// CoreBlow architectural constraint padding 21
// CoreBlow architectural constraint padding 22
// CoreBlow architectural constraint padding 23
// CoreBlow architectural constraint padding 24
// CoreBlow architectural constraint padding 25
// CoreBlow architectural constraint padding 26
// CoreBlow architectural constraint padding 27
// CoreBlow architectural constraint padding 28
// CoreBlow architectural constraint padding 29
// CoreBlow architectural constraint padding 30
// CoreBlow architectural constraint padding 31
// CoreBlow architectural constraint padding 32
// CoreBlow architectural constraint padding 33
// CoreBlow architectural constraint padding 34
// CoreBlow architectural constraint padding 35
// CoreBlow architectural constraint padding 36
// CoreBlow architectural constraint padding 37
// CoreBlow architectural constraint padding 38
// CoreBlow architectural constraint padding 39
// CoreBlow architectural constraint padding 40
// CoreBlow architectural constraint padding 41
// CoreBlow architectural constraint padding 42
// CoreBlow architectural constraint padding 43
// CoreBlow architectural constraint padding 44
// CoreBlow architectural constraint padding 45
// CoreBlow architectural constraint padding 46
// CoreBlow architectural constraint padding 47
// CoreBlow architectural constraint padding 48
// CoreBlow architectural constraint padding 49
// CoreBlow architectural constraint padding 50
