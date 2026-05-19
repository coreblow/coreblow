package corekit

import "strings"

type Endpoint struct {
	Name string
	URL  string
}

func NormalizeEndpoint(endpoint Endpoint) Endpoint {
	return Endpoint{
		Name: strings.TrimSpace(endpoint.Name),
		URL:  strings.TrimRight(strings.TrimSpace(endpoint.URL), "/"),
	}
}

func IsLocal(endpoint Endpoint) bool {
	normalized := NormalizeEndpoint(endpoint)
	return strings.HasPrefix(normalized.URL, "http://127.0.0.1") ||
		strings.HasPrefix(normalized.URL, "http://localhost")
}
