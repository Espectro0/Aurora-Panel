package api

import (
	"bytes"
	"context"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// El navegador graba con MediaRecorder y manda el clip tal cual (Opus en WebM
// u Ogg). El panel lo valida y se lo pasa a Aurora con su token. Aurora
// responde el turno como NDJSON (transcripción, confirmaciones, respuesta y
// audio) y el panel lo retransmite línea a línea.

const maxClipBytes = 10 << 20

var (
	webmMagic = []byte{0x1A, 0x45, 0xDF, 0xA3}
	oggMagic  = []byte("OggS")
)

func (s *Server) handleVoice(w http.ResponseWriter, r *http.Request) {
	clip, ok := s.voiceClip(w, r, true)
	if !ok {
		return
	}
	s.forwardVoice(w, r, "/voice", clip, true)
}

// handleVoiceConfirm responde una confirmación pendiente: ?answer=yes|no
// desde los botones, o un clip con la respuesta dicha en voz alta.
func (s *Server) handleVoiceConfirm(w http.ResponseWriter, r *http.Request) {
	answer := r.URL.Query().Get("answer")
	clip, ok := s.voiceClip(w, r, answer == "")
	if !ok {
		return
	}
	path := "/voice/confirm/" + url.PathEscape(r.PathValue("id"))
	if answer != "" {
		path += "?answer=" + url.QueryEscape(answer)
	}
	s.forwardVoice(w, r, path, clip, false)
}

// voiceClip valida método y configuración y, si needClip, lee el audio Opus.
func (s *Server) voiceClip(w http.ResponseWriter, r *http.Request, needClip bool) ([]byte, bool) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "use POST"})
		return nil, false
	}
	if s.cfg.BaseURL == "" || s.cfg.AuroraAPIToken == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AURORA_API_BASE_URL and AURORA_API_TOKEN must be configured"})
		return nil, false
	}
	if !needClip {
		return nil, true
	}

	clip, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxClipBytes))
	if err != nil {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "clip too large (max 10 MB)"})
		return nil, false
	}
	if !isOpus(clip) {
		writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "expected Opus audio in WebM or Ogg"})
		return nil, false
	}
	return clip, true
}

func (s *Server) forwardVoice(w http.ResponseWriter, r *http.Request, path string, clip []byte, stream bool) {
	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.VoiceTimeout())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.BaseURL+path, bytes.NewReader(clip))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if clip != nil {
		req.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.AuroraAPIToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("voice: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to reach aurora: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	// los errores de Aurora llegan en texto plano; el panel espera {error}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
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

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	if !stream {
		w.WriteHeader(http.StatusOK)
		_, _ = io.Copy(w, resp.Body)
		return
	}

	// cada evento sale en cuanto llega: el panel muestra la transcripción y
	// las confirmaciones mientras Aurora sigue trabajando
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming unsupported"})
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	buf := make([]byte, 32<<10)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			flusher.Flush()
		}
		if err != nil {
			if err != io.EOF {
				log.Printf("voice: stream: %v", err)
			}
			return
		}
	}
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
