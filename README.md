# Dungeon Quest

Fast browser dungeon crawler: pick a hero, clear connected rooms, collect loot, chain defeats, grab power-ups, and defeat tier bosses.

## Current Build

- React + Vite + TypeScript browser game.
- Custom HTML5 Canvas combat engine.
- Four hero classes: Warrior, Archer, Mage, Rogue.
- Procedural room chain with combat, treasure, shop, and boss rooms.
- Loot drops, weapon rarities, inventory, potions, power-ups, run objectives, combo meter, skill tree, minimap, and high score storage.
- Boss phase transitions and next-tier dungeon flow.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```txt
http://127.0.0.1:8080
```

## Online Co-op

Start the WebSocket co-op server:

```bash
npm run coop
```

By default, the game connects to `/coop` on the same host that served the page. In local dev, Vite proxies that WebSocket route to:

```bash
ws://127.0.0.1:8787
```

If you host the WebSocket server separately, set `VITE_COOP_URL` before starting Vite:

```powershell
$env:VITE_COOP_URL="wss://your-public-coop-server.example"; npm run dev
```

For LAN testing, use your computer's local IP:

```powershell
$env:VITE_COOP_URL="ws://192.168.0.10:8787"; npm run dev
```

## GitHub Pages

The repository is ready to deploy the static game client to GitHub Pages through GitHub Actions.

Expected Pages URL:

```txt
https://kellernz1.github.io/dungeon-quest/
```

Deployment happens automatically when changes are pushed to `main` through:

```txt
.github/workflows/deploy-pages.yml
```

In the GitHub repository settings, set Pages source to **GitHub Actions**.

GitHub Pages only serves the static browser game. The online co-op WebSocket server is not hosted by GitHub Pages. Solo play works immediately on Pages; online co-op needs an external WebSocket server and a repository variable named `VITE_COOP_URL`, for example:

```txt
wss://your-coop-server.example
```

## Useful Scripts

```bash
npm run build
npm run test
npm run lint
```

## Direction

The current codebase is a fast browser dungeon crawler with host-authoritative co-op scaffolding. The best near-term path is:

1. Polish combat feel, enemy variety, and room objectives.
2. Move game data into JSON files.
3. Split the engine into smaller systems.
4. Add real sprites/tilesets and sound assets.
5. Move more combat, enemy AI, and loot authority from the browser host into a dedicated backend.
