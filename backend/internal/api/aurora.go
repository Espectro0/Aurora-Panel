package api

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// Parámetros que Aurora acepta en /guard y /guard/stats; el resto se descarta.
var guardParams = []string{"limit", "decision", "server", "skill", "since"}

func (s *Server) handleGuard(w http.ResponseWriter, r *http.Request) {
	s.proxyAurora(w, r, "/guard", guardParams)
}

func (s *Server) handleGuardStats(w http.ResponseWriter, r *http.Request) {
	s.proxyAurora(w, r, "/guard/stats", []string{"since"})
}

func (s *Server) handleMCPServers(w http.ResponseWriter, r *http.Request) {
	s.proxyAurora(w, r, "/mcp/servers", nil)
}

// proxyAurora reenvía un GET JSON a Aurora. Los 4xx de Aurora (texto plano)
// se devuelven como {"error": ...} con el mismo status.
func (s *Server) proxyAurora(w http.ResponseWriter, r *http.Request, path string, params []string) {
	if s.cfg.BaseURL == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AURORA_API_BASE_URL is not configured"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.RequestTimeout())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, auroraURL(s.cfg.BaseURL, path, r.URL.Query(), params), nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("aurora %s: %v", path, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to reach aurora: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to read aurora response: " + err.Error()})
		return
	}

	if resp.StatusCode >= 300 {
		status := http.StatusBadGateway
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			status = resp.StatusCode
		}
		writeJSON(w, status, map[string]string{"error": strings.TrimSpace(string(body))})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// handleGuardStream retransmite el SSE de Aurora tal cual, sin timeout:
// la conexión vive mientras el navegador siga escuchando.
func (s *Server) handleGuardStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	if s.cfg.BaseURL == "" {
		http.Error(w, "AURORA_API_BASE_URL is not configured", http.StatusServiceUnavailable)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, s.cfg.BaseURL+"/guard/stream", nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Accept", "text/event-stream")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("aurora guard stream: %v", err)
		http.Error(w, "failed to reach aurora: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		http.Error(w, strings.TrimSpace(string(body)), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			flusher.Flush()
		}
		if err != nil {
			if !errors.Is(err, io.EOF) && r.Context().Err() == nil {
				log.Printf("aurora guard stream: %v", err)
			}
			return
		}
	}
}

func auroraURL(base, path string, in url.Values, params []string) string {
	out := url.Values{}
	for _, p := range params {
		if v := in.Get(p); v != "" {
			out.Set(p, v)
		}
	}
	u := base + path
	if len(out) > 0 {
		u += "?" + out.Encode()
	}
	return u
}
