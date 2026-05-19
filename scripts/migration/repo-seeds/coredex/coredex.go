package coredex

import "strings"

type Contact struct {
	ID          string
	DisplayName string
	Channel     string
	Address     string
}

func NormalizeContact(contact Contact) Contact {
	return Contact{
		ID:          strings.TrimSpace(contact.ID),
		DisplayName: strings.TrimSpace(contact.DisplayName),
		Channel:     strings.ToLower(strings.TrimSpace(contact.Channel)),
		Address:     strings.TrimSpace(contact.Address),
	}
}

func SearchableName(contact Contact) string {
	normalized := NormalizeContact(contact)
	if normalized.DisplayName != "" {
		return strings.ToLower(normalized.DisplayName)
	}
	return strings.ToLower(normalized.Address)
}
