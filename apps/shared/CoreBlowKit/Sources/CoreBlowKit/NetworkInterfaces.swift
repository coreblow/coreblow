import Foundation
public enum NetworkInterfaces {
    public static func allIPv4() -> [NetworkInterfaceIPv4] {
        var interfaces: [NetworkInterfaceIPv4] = []; var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return [] }
        for ptr in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let family = ptr.pointee.ifa_addr.pointee.sa_family; guard family == UInt8(AF_INET) else { continue }
            let name = String(cString: ptr.pointee.ifa_name)
            var addr = ptr.pointee.ifa_addr.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee }
            var buf = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN)); inet_ntop(AF_INET, &addr.sin_addr, &buf, socklen_t(INET_ADDRSTRLEN))
            interfaces.append(NetworkInterfaceIPv4(name: name, address: String(cString: buf), netmask: "255.255.255.0"))
        }
        freeifaddrs(ifaddr); return interfaces
    }
}
