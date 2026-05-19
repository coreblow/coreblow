package corekit

import "testing"

func TestNormalizeEndpoint(t *testing.T) {
	got := NormalizeEndpoint(Endpoint{Name: " gateway ", URL: " http://localhost:3000/ "})
	if got.Name != "gateway" || got.URL != "http://localhost:3000" {
		t.Fatalf("unexpected endpoint: %#v", got)
	}
}

func TestIsLocal(t *testing.T) {
	if !IsLocal(Endpoint{URL: "http://127.0.0.1:3000"}) {
		t.Fatal("expected loopback endpoint to be local")
	}
}
