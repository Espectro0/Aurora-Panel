<table border="0">
  <tr>
    <td width="160" align="center" valign="middle">
      <img src="assets/images/aurora.png" alt="Aurora Panel" width="150">
    </td>
    <td valign="middle">
      <h1>Aurora Panel</h1>
      <p>A companion dashboard for <a href="https://github.com/Espectro0/Aurora">Aurora</a>, a persistent conversational agent. Visualize its memory graph as it grows.</p>
    </td>
  </tr>
</table>

Aurora Panel is a read-only web dashboard that connects to Aurora's memory: the [Qdrant](https://qdrant.tech) vector collection where its long-term memories live and the typed cognitive graph  it builds between them. It renders that data as an interactive, force-directed graph so you can explore what Aurora remembers, how memories are connected, and how its understanding of people and concepts evolves over time.

The panel never writes to Aurora's memory. It only reads it. It is a separate Go backend and Next.js frontend, decoupled from the bot itself: point it at the same Qdrant instance and, optionally, the same `edges.json`, and it works against any Aurora deployment.

## Features

- **Live memory graph** — every point in Aurora's Qdrant collection rendered as a node, color-coded by type.
- **Typed relationships** — when Aurora's real `edges.json` is available, connections are drawn with their actual type and weight.
- **Similarity fallback** — without an `edges.json` source, the panel derives edges itself from cosine similarity between memory vectors, using the same clustering logic Aurora applies internally.
- **Interactive exploration** — click any node or edge to open a detail panel with its content, timestamp, metadata, and connections; jump between linked memories without losing your place.
- **Adjustable threshold** — tune the similarity cutoff straight from the graph view or via query parameters.
- **Read-only by design** — the backend only ever queries Qdrant and the edges file; it has no write path into Aurora's memory.

## Architecture

```
                    ┌──────────────────────────┐
                    │   Aurora (the bot)        │
                    │   writes memories to →    │
                    └────────────┬──────────────┘
                                 │
              ┌──────────────────┴───────────────────┐
              ▼                                       ▼
      Qdrant (aurora_memories)              aurora.edges.json
      vectors + payload                     typed graph edges
              │                                       │
              └──────────────────┬────────────────────┘
                                 ▼
                    backend/  (Go, net/http)
                    GET /api/health   — Qdrant reachability
                    GET /api/graph    — nodes + edges as JSON
                                 │
                                 ▼
                    frontend/ (Next.js, vis-network)
                    /        — status dashboard
                    /mind    — interactive memory graph
```

The backend never talks to the LLM or to Discord/Telegram — it is purely a read path from Aurora's storage to the browser. `EDGES_PATH` / `EDGES_URL` are optional; when neither is set, the panel still works, falling back to similarity-derived edges.

## Technology Stack

| Concern | Technology |
| --- | --- |
| Backend language | Go (`net/http`, no framework) |
| Backend API | `GET /api/health`, `GET /api/graph` |
| Vector memory source | Qdrant REST API (read-only) |
| Cognitive graph source | Aurora's `edges.json` (local path or HTTP URL) |
| Frontend framework | Next.js 16 (App Router), React 19 |
| Graph rendering | vis-network / vis-data, with `react-force-graph-2d` and `@nivo/network` available |
| Styling | Tailwind CSS 4 |

## Requirements

- Go 1.22+
- Node.js 20+
- A running [Qdrant](https://qdrant.tech) instance holding Aurora's memory collection (see the main Aurora project for how it's populated)
- Optionally, access to Aurora's `data/aurora.edges.json` for real typed edges instead of the similarity fallback

## Setup

Clone the repo, then set up the backend and frontend separately.

### Backend

```
cd backend
cp .env.example .env
go run ./cmd/server
```

### Frontend

```
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000` for the dashboard, or go straight to `http://localhost:3000/mind` for the memory graph.

## Configuration

### Backend — `backend/.env`

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | no | `8080` | Port the API server listens on |
| `QDRANT_URL` | yes | — | Qdrant base URL (e.g. `http://localhost:6333`) |
| `QDRANT_API_KEY` | no | — | Qdrant API key, for a secured/remote instance |
| `QDRANT_COLLECTION` | yes | — | Name of Aurora's memory collection (e.g. `aurora_memories`) |
| `SIMILARITY_THRESHOLD` | no | `0.75` | Default cosine similarity cutoff for the fallback graph |
| `MAX_GRAPH_POINTS` | no | `1500` | Default cap on points fetched per `/api/graph` request |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` | Comma-separated list of origins allowed by CORS |
| `EDGES_PATH` | no | — | Local filesystem path to Aurora's `edges.json` |
| `EDGES_URL` | no | — | HTTP URL serving Aurora's `edges.json`, if not a local file |

At most one of `EDGES_PATH` / `EDGES_URL` should be set. If neither is set, edges are derived from vector similarity instead.

### Frontend — `frontend/.env.local`

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:8080` | Base URL of the Aurora Panel backend |

## API

### `GET /api/health`

Reports whether the configured Qdrant collection is reachable.

```json
{ "status": "ok", "collection": "aurora_memories", "exists": true }
```

### `GET /api/graph`

Returns the memory graph as nodes and edges. Accepts two optional query parameters:

| Param | Description |
| --- | --- |
| `threshold` | Overrides `SIMILARITY_THRESHOLD` for this request (only affects the similarity fallback) |
| `limit` | Overrides `MAX_GRAPH_POINTS` for this request |

```json
{
  "nodes": [
    { "id": "...", "type": "concept", "content": "...", "created_at": "..." }
  ],
  "edges": [
    { "source": "...", "target": "...", "type": "relates", "weight": 0.92 }
  ]
}
```

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0). You can review the full text in [LICENSE](LICENSE).
