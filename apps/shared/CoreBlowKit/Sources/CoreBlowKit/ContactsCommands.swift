import Contacts; import Foundation
public enum ContactsCommands {
    public static func search(query: String) async throws -> [[String: String]] {
        let store = CNContactStore(); try await store.requestAccess(for: .contacts)
        let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactEmailAddressesKey] as [CNKeyDescriptor]
        let pred = CNContact.predicateForContacts(matchingName: query)
        return try store.unifiedContacts(matching: pred, keysToFetch: keys).map { ["name": "\($0.givenName) \($0.familyName)", "email": $0.emailAddresses.first?.value as String? ?? ""] }
    }
}
