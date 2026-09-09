// Package graph turns raw Qdrant points into graph nodes, and pairs them
// with edges — either Aurora's real typed edges when available, or a
// cosine-similarity fallback (mirroring the clustering heuristic Aurora
// itself uses, default threshold 0.70) when they are not.
package graph

import (
	"math"

	"github.com/Espectro0/AuroraPanel/internal/edges"
	"github.com/Espectro0/AuroraPanel/internal/qdrant"
)

const SimilarityEdgeType = "similarity"

type Node struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Content   string         `json:"content"`
	CreatedAt string         `json:"created_at,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

type Edge struct {
	Source    string  `json:"source"`
	Target    string  `json:"target"`
	Type      string  `json:"type"`
	Weight    float64 `json:"weight"`
	CreatedAt string  `json:"created_at,omitempty"`
}

type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

// BuildNodes converts Qdrant points into graph nodes.
func BuildNodes(points []qdrant.Point) []Node {
	nodes := make([]Node, 0, len(points))
	for _, p := range points {
		nodes = append(nodes, pointToNode(p))
	}
	return nodes
}

// RealEdges converts Aurora's typed edges into graph edges, keeping only
// those whose endpoints are both present in knownIDs.
func RealEdges(real []edges.Edge, knownIDs map[string]bool) []Edge {
	out := make([]Edge, 0, len(real))
	for _, e := range real {
		if !knownIDs[e.SourceID] || !knownIDs[e.TargetID] {
			continue
		}
		out = append(out, Edge{
			Source:    e.SourceID,
			Target:    e.TargetID,
			Type:      e.Type,
			Weight:    e.Weight,
			CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return out
}

// SimilarityEdges links any two nodes whose vector cosine similarity is
// >= threshold. Used when Aurora's real edges aren't available.
func SimilarityEdges(points []qdrant.Point, threshold float64) []Edge {
	var result []Edge
	for i := 0; i < len(points); i++ {
		for j := i + 1; j < len(points); j++ {
			if len(points[i].Vector) == 0 || len(points[j].Vector) == 0 {
				continue
			}
			sim := cosine(points[i].Vector, points[j].Vector)
			if sim >= threshold {
				result = append(result, Edge{
					Source: points[i].ID,
					Target: points[j].ID,
					Type:   SimilarityEdgeType,
					Weight: sim,
				})
			}
		}
	}
	return result
}

func pointToNode(p qdrant.Point) Node {
	n := Node{ID: p.ID}

	if t, ok := p.Payload["type"].(string); ok {
		n.Type = t
	}
	if c, ok := p.Payload["content"].(string); ok {
		n.Content = c
	}
	if ts, ok := p.Payload["created_at"].(string); ok {
		n.CreatedAt = ts
	}
	if m, ok := p.Payload["metadata"].(map[string]any); ok {
		n.Metadata = m
	}

	return n
}

func cosine(a, b []float32) float64 {
	var dot, na, nb float64
	for i := range a {
		va := float64(a[i])
		vb := float64(b[i])
		dot += va * vb
		na += va * va
		nb += vb * vb
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}
