package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all runtime configuration, sourced entirely from environment
// variables so the panel backend stays decoupled from the Aurora bot itself.
type Config struct {
	Port                string
	QdrantURL           string
	QdrantAPIKey        string
	QdrantCollection    string
	SimilarityThreshold float64
	MaxGraphPoints      int
	AllowedOrigins      []string
	// EdgesPath/EdgesURL point at Aurora's real edges.json (typed edges:
	// participates, mentions, relates, ...). At most one should be set. If
	// neither is set, the graph falls back to similarity-derived edges.
	EdgesPath string
	EdgesURL  string
}

func Load() Config {
	return Config{
		Port:                envOr("PORT", "8080"),
		QdrantURL:           os.Getenv("QDRANT_URL"),
		QdrantAPIKey:        os.Getenv("QDRANT_API_KEY"),
		QdrantCollection:    os.Getenv("QDRANT_COLLECTION"),
		SimilarityThreshold: envFloat("SIMILARITY_THRESHOLD", 0.75),
		MaxGraphPoints:      envInt("MAX_GRAPH_POINTS", 1500),
		AllowedOrigins:      envList("ALLOWED_ORIGINS", "http://localhost:3000"),
		EdgesPath:           os.Getenv("EDGES_PATH"),
		EdgesURL:            os.Getenv("EDGES_URL"),
	}
}

// RequestTimeout bounds how long a single API request may take to reach
// Qdrant and build the graph.
func (c Config) RequestTimeout() time.Duration {
	return 30 * time.Second
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func envList(key, fallback string) []string {
	raw := envOr(key, fallback)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
