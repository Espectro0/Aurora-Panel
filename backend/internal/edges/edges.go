package edges

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Edge struct {
	ID        string    `json:"ID"`
	SourceID  string    `json:"SourceID"`
	TargetID  string    `json:"TargetID"`
	Type      string    `json:"Type"`
	Weight    float64   `json:"Weight"`
	CreatedAt time.Time `json:"CreatedAt"`
}

func Configured(url string) bool {
	return url != ""
}

func Load(ctx context.Context, url string) ([]Edge, error) {
	var raw []byte
	var err error

	switch {
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
