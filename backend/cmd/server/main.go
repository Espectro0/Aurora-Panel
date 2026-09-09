package main

import (
	"log"
	"net/http"

	"github.com/Espectro0/AuroraPanel/internal/api"
	"github.com/Espectro0/AuroraPanel/internal/config"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	cfg := config.Load()
	srv := api.NewServer(cfg)

	log.Printf("aurora-panel backend listening on :%s (qdrant=%s collection=%s threshold=%.2f)",
		cfg.Port, cfg.QdrantURL, cfg.QdrantCollection, cfg.SimilarityThreshold)

	if err := http.ListenAndServe(":"+cfg.Port, srv.Routes()); err != nil {
		log.Fatalf("server: %v", err)
	}
}
