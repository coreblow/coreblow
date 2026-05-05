import Contacts
import Foundation

/// Provides contact search and creation for gateway invoke commands.
final class ContactsService {

    private static var payloadKeys: [CNKeyDescriptor] {
        [
            CNContactIdentifierKey as CNKeyDescriptor,
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
        ]
    }

    func search(query: String?, limit: Int?) async throws -> CoreBlowContactsPayload {
        let store = try await Self.authorizedStore()
        let cap = max(1, min(limit ?? 25, 200))

        var contacts: [CNContact] = []
        if let q = query?.trimmingCharacters(in: .whitespacesAndNewlines), !q.isEmpty {
            let predicate = CNContact.predicateForContacts(matchingName: q)
            contacts = try store.unifiedContacts(matching: predicate, keysToFetch: Self.payloadKeys)
        } else {
            let request = CNContactFetchRequest(keysToFetch: Self.payloadKeys)
            try store.enumerateContacts(with: request) { contact, stop in
                contacts.append(contact)
                if contacts.count >= cap { stop.pointee = true }
            }
        }

        let sliced = Array(contacts.prefix(cap))
        return CoreBlowContactsPayload(contacts: sliced.map { Self.payload(from: $0) })
    }

    func add(givenName: String?, familyName: String?, displayName: String?,
             organizationName: String?, phoneNumbers: [String]?,
             emails: [String]?) async throws -> CoreBlowContactPayload {
        let store = try await Self.authorizedStore()

        let phones = Self.normalizeStrings(phoneNumbers)
        let mails = Self.normalizeStrings(emails, lowercased: true)
        let given = givenName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let family = familyName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let display = displayName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let org = organizationName?.trimmingCharacters(in: .whitespacesAndNewlines)

        let hasName = !(given ?? "").isEmpty || !(family ?? "").isEmpty || !(display ?? "").isEmpty
        let hasOrg = !(org ?? "").isEmpty
        guard hasName || hasOrg || !phones.isEmpty || !mails.isEmpty else {
            throw NSError(domain: "Contacts", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "CONTACTS_INVALID: include a name, organization, phone, or email",
            ])
        }

        // Check for existing
        if let existing = try Self.findExisting(store: store, phoneNumbers: phones, emails: mails) {
            return Self.payload(from: existing)
        }

        let contact = CNMutableContact()
        contact.givenName = given ?? ""
        contact.familyName = family ?? ""
        contact.organizationName = org ?? ""
        if contact.givenName.isEmpty && contact.familyName.isEmpty, let display {
            contact.givenName = display
        }
        contact.phoneNumbers = phones.map {
            CNLabeledValue(label: CNLabelPhoneNumberMobile, value: CNPhoneNumber(stringValue: $0))
        }
        contact.emailAddresses = mails.map {
            CNLabeledValue(label: CNLabelHome, value: $0 as NSString)
        }

        let save = CNSaveRequest()
        save.add(contact, toContainerWithIdentifier: nil)
        try store.execute(save)

        let persisted: CNContact
        if !contact.identifier.isEmpty {
            persisted = try store.unifiedContact(withIdentifier: contact.identifier, keysToFetch: Self.payloadKeys)
        } else {
            persisted = contact
        }
        return Self.payload(from: persisted)
    }

    // MARK: - Private

    private static func authorizedStore() async throws -> CNContactStore {
        let store = CNContactStore()
        let status = CNContactStore.authorizationStatus(for: .contacts)
        guard status == .authorized || status == .limited else {
            throw NSError(domain: "Contacts", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "CONTACTS_PERMISSION_REQUIRED: grant Contacts permission",
            ])
        }
        return store
    }

    private static func normalizeStrings(_ values: [String]?, lowercased: Bool = false) -> [String] {
        (values ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { lowercased ? $0.lowercased() : $0 }
    }

    private static func findExisting(store: CNContactStore, phoneNumbers: [String], emails: [String]) throws -> CNContact? {
        guard !phoneNumbers.isEmpty || !emails.isEmpty else { return nil }
        var matches: [CNContact] = []
        for phone in phoneNumbers {
            let predicate = CNContact.predicateForContacts(matching: CNPhoneNumber(stringValue: phone))
            matches.append(contentsOf: try store.unifiedContacts(matching: predicate, keysToFetch: payloadKeys))
        }
        for email in emails {
            let predicate = CNContact.predicateForContacts(matchingEmailAddress: email)
            matches.append(contentsOf: try store.unifiedContacts(matching: predicate, keysToFetch: payloadKeys))
        }
        return matchBestContact(contacts: matches, phoneNumbers: phoneNumbers, emails: emails)
    }

    private static func matchBestContact(contacts: [CNContact], phoneNumbers: [String], emails: [String]) -> CNContact? {
        let normalizedPhones = Set(phoneNumbers.map { normalizePhone($0) }.filter { !$0.isEmpty })
        let normalizedEmails = Set(emails.map { $0.lowercased() }.filter { !$0.isEmpty })
        var seen = Set<String>()
        for contact in contacts {
            guard seen.insert(contact.identifier).inserted else { continue }
            let cPhones = Set(contact.phoneNumbers.map { normalizePhone($0.value.stringValue) })
            let cEmails = Set(contact.emailAddresses.map { String($0.value).lowercased() })
            if !normalizedPhones.isEmpty, !cPhones.isDisjoint(with: normalizedPhones) { return contact }
            if !normalizedEmails.isEmpty, !cEmails.isDisjoint(with: normalizedEmails) { return contact }
        }
        return nil
    }

    private static func normalizePhone(_ phone: String) -> String {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let digits = trimmed.unicodeScalars.filter { CharacterSet.decimalDigits.contains($0) }
        let normalized = String(String.UnicodeScalarView(digits))
        return normalized.isEmpty ? trimmed : normalized
    }

    private static func payload(from contact: CNContact) -> CoreBlowContactPayload {
        CoreBlowContactPayload(
            identifier: contact.identifier,
            displayName: CNContactFormatter.string(from: contact, style: .fullName)
                ?? "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespacesAndNewlines),
            givenName: contact.givenName,
            familyName: contact.familyName,
            organizationName: contact.organizationName,
            phoneNumbers: contact.phoneNumbers.map { $0.value.stringValue },
            emails: contact.emailAddresses.map { String($0.value) })
    }
}

// MARK: - Payload Types

struct CoreBlowContactsPayload { let contacts: [CoreBlowContactPayload] }
struct CoreBlowContactPayload {
    let identifier: String; let displayName: String; let givenName: String
    let familyName: String; let organizationName: String
    let phoneNumbers: [String]; let emails: [String]
}
