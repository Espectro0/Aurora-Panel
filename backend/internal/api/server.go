package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/Espectro0/AuroraPanel/internal/config"
	"github.com/Espectro0/AuroraPanel/internal/edges"
	"github.com/Espectro0/AuroraPanel/internal/graph"
	"github.com/Espectro0/AuroraPanel/internal/qdrant"
)

type Server struct {
	cfg    config.Config
	client *qdrant.Client
}

func NewServer(cfg config.Config) *Server {
	return &Server{
		cfg:    cfg,
		client: qdrant.New(cfg.QdrantURL, cfg.QdrantAPIKey, cfg.QdrantCollection),
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/graph", s.handleGraph)
	return s.withCORS(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.RequestTimeout())
	defer cancel()

	exists, err := s.client.CollectionExists(ctx)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"collection": s.cfg.QdrantCollection,
		"exists":     exists,
	})
}

func (s *Server) handleGraph(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.RequestTimeout())
	defer cancel()

	threshold := s.cfg.SimilarityThreshold
	if raw := r.URL.Query().Get("threshold"); raw != "" {
		if v, err := strconv.ParseFloat(raw, 64); err == nil && v > 0 && v <= 1 {
			threshold = v
		}
	}

	maxPoints := s.cfg.MaxGraphPoints
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			maxPoints = v
		}
	}

	points, err := s.client.ScrollAllPoints(ctx, maxPoints)
	if err != nil {
		log.Printf("graph: scroll failed: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to reach qdrant: " + err.Error()})
		return
	}

	nodes := graph.BuildNodes(points)

	graphEdges, err := s.resolveEdges(ctx, points, nodes, threshold)
	if err != nil {
		log.Printf("graph: edges failed: %v", err)
	}

	writeJSON(w, http.StatusOK, graph.Graph{Nodes: nodes, Edges: graphEdges})
}

func (s *Server) resolveEdges(ctx context.Context, points []qdrant.Point, nodes []graph.Node, threshold float64) ([]graph.Edge, error) {
	if edges.Configured(s.cfg.EdgesURL) {
		real, err := edges.Load(ctx, s.cfg.EdgesURL)
		if err != nil {
			return graph.SimilarityEdges(points, threshold), err
		}

		known := make(map[string]bool, len(nodes))
		for _, n := range nodes {
			known[n.ID] = true
		}
		return graph.RealEdges(real, known), nil
	}

	return graph.SimilarityEdges(points, threshold), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
