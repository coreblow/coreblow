package coredex

import "testing"

func TestNormalizeContact(t *testing.T) {
	got := NormalizeContact(Contact{ID: " a ", DisplayName: " Ada ", Channel: " Email ", Address: " ada@example.com "})
	if got.ID != "a" || got.DisplayName != "Ada" || got.Channel != "email" || got.Address != "ada@example.com" {
		t.Fatalf("unexpected contact: %#v", got)
	}
}

func TestSearchableNameFallsBackToAddress(t *testing.T) {
	got := SearchableName(Contact{Address: "USER@EXAMPLE.COM"})
	if got != "user@example.com" {
		t.Fatalf("unexpected searchable name: %s", got)
	}
}
