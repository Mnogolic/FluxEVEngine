# FluxEV Frontend

Standalone Next.js frontend for `FluxEVEngine`.

## Requirements

- Bun `1.3.9+`
- Running backend on `http://127.0.0.1:8001`

## Setup

```bash
cd frontend
copy .env.example .env.local
bun install
```

## Run

```bash
bun dev
```

Open `http://localhost:8000`.

## Useful commands

```bash
bun run lint
bun run lint:type
bun run build
```
