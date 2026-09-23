package journal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Entry struct {
	Timestamp time.Time `json:"timestamp"`
	Content   string    `json:"content"`
	Mood      string    `json:"mood"`
}

func Configured(url string) bool {
	return url != ""
}

func Load(ctx context.Context, url string) ([]Entry, error) {
	if url == "" {
		return nil, nil
	}

	raw, err := fetch(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("journal: fetch %s: %w", url, err)
	}

	var entries []Entry
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, fmt.Errorf("journal: decode: %w", err)
	}
	return entries, nil
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
