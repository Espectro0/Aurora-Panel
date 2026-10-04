package api

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"strings"
)

// El navegador graba con MediaRecorder y manda el clip tal cual (Opus en WebM
// u Ogg). El panel lo valida y se lo pasa a Aurora con su token; Aurora
// transcribe, responde y devuelve también la respuesta hablada.

const maxClipBytes = 10 << 20

var (
	webmMagic = []byte{0x1A, 0x45, 0xDF, 0xA3}
	oggMagic  = []byte("OggS")
)

func (s *Server) handleVoice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "use POST"})
		return
	}
	if s.cfg.BaseURL == "" || s.cfg.AuroraAPIToken == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AURORA_API_BASE_URL and AURORA_API_TOKEN must be configured"})
		return
	}

	clip, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxClipBytes))
	if err != nil {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "clip too large (max 10 MB)"})
		return
	}
	if !isOpus(clip) {
		writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "expected Opus audio in WebM or Ogg"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.VoiceTimeout())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.BaseURL+"/voice", bytes.NewReader(clip))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	req.Header.Set("Authorization", "Bearer "+s.cfg.AuroraAPIToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("voice: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to reach aurora: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to read aurora response: " + err.Error()})
		return
	}

	// los errores de Aurora llegan en texto plano; el panel espera {error}
	if resp.StatusCode != http.StatusOK {
		status := http.StatusBadGateway
		if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != http.StatusUnauthorized {
			status = resp.StatusCode
		}
		msg := strings.TrimSpace(string(body))
		if resp.StatusCode == http.StatusUnauthorized {
			msg = "aurora rejected the panel's AURORA_API_TOKEN"
		}
		writeJSON(w, status, map[string]string{"error": msg})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// el contenedor se reconoce por su firma y el códec por su marca dentro
func isOpus(clip []byte) bool {
	switch {
	case bytes.HasPrefix(clip, webmMagic):
		return bytes.Contains(clip, []byte("A_OPUS"))
	case bytes.HasPrefix(clip, oggMagic):
		return bytes.Contains(clip, []byte("OpusHead"))
	}
	return false
}
