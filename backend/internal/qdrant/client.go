// Package qdrant is a minimal, read-only REST client for the Qdrant vector
// database (https://api.qdrant.tech/api-reference). It only implements the
// operations the panel needs: collection info and scrolling points with
// their vectors and payload.
package qdrant

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	http       *http.Client
	baseURL    string
	apiKey     string
	collection string
}

func New(baseURL, apiKey, collection string) *Client {
	return &Client{
		http:       &http.Client{Timeout: 60 * time.Second},
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		collection: collection,
	}
}

type Point struct {
	ID      string         `json:"id"`
	Vector  []float32      `json:"vector,omitempty"`
	Payload map[string]any `json:"payload,omitempty"`
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) (int, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, fmt.Errorf("qdrant: marshal: %w", err)
		}
		reader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return 0, fmt.Errorf("qdrant: request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return 0, fmt.Errorf("qdrant: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 300 {
		return resp.StatusCode, fmt.Errorf("qdrant: status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			return resp.StatusCode, fmt.Errorf("qdrant: decode: %w", err)
		}
	}

	return resp.StatusCode, nil
}

// CollectionInfo checks the collection exists and returns its point count.
func (c *Client) CollectionExists(ctx context.Context) (bool, error) {
	status, err := c.do(ctx, http.MethodGet, "/collections/"+c.collection, nil, nil)
	if err != nil {
		if status == http.StatusNotFound {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// ScrollAllPoints pages through every point in the collection, including
// vectors and payload, up to maxPoints (0 = unlimited).
func (c *Client) ScrollAllPoints(ctx context.Context, maxPoints int) ([]Point, error) {
	var all []Point
	var offset any

	for {
		limit := 256
		body := map[string]any{
			"limit":        limit,
			"with_vector":  true,
			"with_payload": true,
		}
		if offset != nil {
			body["offset"] = offset
		}

		var result struct {
			Result struct {
				Points         []Point `json:"points"`
				NextPageOffset any     `json:"next_page_offset"`
			} `json:"result"`
		}

		if _, err := c.do(ctx, http.MethodPost, "/collections/"+c.collection+"/points/scroll", body, &result); err != nil {
			return nil, fmt.Errorf("qdrant: scroll: %w", err)
		}

		all = append(all, result.Result.Points...)

		if maxPoints > 0 && len(all) >= maxPoints {
			return all[:maxPoints], nil
		}
		if result.Result.NextPageOffset == nil || len(result.Result.Points) == 0 {
			break
		}
		offset = result.Result.NextPageOffset
	}

	return all, nil
}
