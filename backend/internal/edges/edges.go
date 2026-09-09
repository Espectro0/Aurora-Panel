// Package edges loads Aurora's real, typed memory edges (participates,
// mentions, relates, prefers, reflects_on, leads_to, sentiment) from the
// edges.json file Aurora's qdrant.Store persists them to. That file lives
// outside Qdrant, so it's read either from a local path or an HTTP URL.
package edges

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Edge mirrors Aurora's internal/memory.Edge as it is JSON-encoded (no
// struct tags there, so field names are the JSON keys verbatim).
type Edge struct {
	ID        string    `json:"ID"`
	SourceID  string    `json:"SourceID"`
	TargetID  string    `json:"TargetID"`
	Type      string    `json:"Type"`
	Weight    float64   `json:"Weight"`
	CreatedAt time.Time `json:"CreatedAt"`
}

// Configured reports whether a real edges source was provided.
func Configured(path, url string) bool {
	return path != "" || url != ""
}

// Load reads Aurora's edges.json (a map of source node ID -> []Edge, as
// written by Store.saveEdges) from a local path or, if empty, an HTTP URL.
// It returns (nil, nil) when neither source is configured.
func Load(ctx context.Context, path, url string) ([]Edge, error) {
	var raw []byte
	var err error

	switch {
	case path != "":
		raw, err = os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("edges: read %s: %w", path, err)
		}
	case url != "":
		raw, err = fetch(ctx, url)
		if err != nil {
			return nil, fmt.Errorf("edges: fetch %s: %w", url, err)
		}
	default:
		return nil, nil
	}

	if len(raw) == 0 {
		return nil, nil
	}

	var bySource map[string][]Edge
	if err := json.Unmarshal(raw, &bySource); err != nil {
		return nil, fmt.Errorf("edges: decode: %w", err)
	}

	var all []Edge
	for _, es := range bySource {
		all = append(all, es...)
	}
	return all, nil
}

func fetch(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}
	return io.ReadAll(resp.Body)
}
