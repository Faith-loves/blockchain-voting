# Blockchain Voting (React + Vite + Express + Hardhat)

This project contains three parts:

- `client` – React/Vite frontend
- `server` – Express API + MongoDB + on-chain verification
- `chain` – Hardhat contract project

## Prerequisites

- Node.js 18+
- MongoDB running locally
- MetaMask browser extension
- Git

## Environment setup

1. Copy example env files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
cp chain/.env.example chain/.env   # optional, if you use custom env values
```

2. Edit `server/.env`:

- `MONGO_URI`: your MongoDB URI
- `JWT_SECRET`: strong random string
- `RECEIPT_SECRET`: strong random string (32+ chars)
- `CLIENT_ORIGIN`: frontend URL (default `http://localhost:5173`)
- `CHAIN_RPC_URL`: `http://127.0.0.1:8545` (Hardhat local node)
- `CHAIN_PRIVATE_KEY`: account private key used for blockchain writes
- `VOTING_CONTRACT_ADDRESS`: deployed contract address

3. Ensure `server/src/chain.js` contract address matches `server/.env` (`VOTING_CONTRACT_ADDRESS`).

## Run locally (3 terminals)

Terminal 1 (blockchain):

```bash
cd chain
npm install
npm run node
```

Terminal 2 (deploy contract after terminal 1 is running):

```bash
cd chain
npm install
npm run deploy
```

Then copy the deployed contract address into:

- `server/.env` (`VOTING_CONTRACT_ADDRESS`)
- `client/src/config.ts` (`CONTRACT_ADDRESS`)

Terminal 3 (server):

```bash
cd server
npm install
npm run dev
```

Terminal 4 (client):

```bash
cd client
npm install
npm run dev
```

Frontend should be available at `http://localhost:5173`.

## MetaMask settings for local testing

- Add network manually:
  - Network Name: `Hardhat Local`
  - RPC URL: `http://127.0.0.1:8545`
  - Chain ID: `31337`
- Import one of Hardhat test accounts for voting/deployment.
- Use your test wallet to vote and verify receipts.

## GitHub push (from terminal)

From the project root:

```bash
git init
git add .
git commit -m "Setup blockchain voting app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If `.git` already exists, skip `git init` and re-run from `git add` onward.

## Notes

- `client` currently expects API at `http://localhost:5000` by default (`client/.env.example` has `VITE_API_BASE_URL`).
- Keep `.env` files out of source control (already ignored).
- If someone else clones the repo, they should run `npm install` in each folder and follow this sequence.

## Deployment notes (fixes 404)

If you see `404: NOT_FOUND` after deploy, it is usually one of these:

1) The frontend is being hosted as a static SPA but deep-link routes (`/vote`, `/admin`, etc.) are not rewritten to `index.html`.
2) The server is missing the built client files (`client/dist`) at runtime.
3) The frontend is calling the wrong API base URL in production.

### Option A: Fullstack on one service (recommended)

- Build frontend first: `npm install --prefix client && npm run build --prefix client`
- Start backend: `npm install --prefix server && npm run start --prefix server`
- Ensure `server` serves `client/dist` at runtime (already supported by server code).
- Set in `server/.env`:
  - `CLIENT_ORIGIN=https://your-deployed-domain`
- Build/start on a service that runs both folders so `server` can serve `client/dist`.

### Option B: Frontend + Backend deployed separately

- Backend: deploy `server` with `node server/index.js` on port `5000` (or your host port).
- Frontend: build+host `client` only.
- In `client/.env`:
  - `VITE_API_BASE_URL=https://your-backend-domain`

### Option C: If using static hosts (Netlify/Cloudflare Pages/etc.)

- Keep `client/public/_redirects` so all routes fall back to `index.html`:
  - `/* /index.html 200`
- Ensure API calls still target the backend URL (`VITE_API_BASE_URL`) when backend is separate.

## For Evaluators (Quick Copy-Paste)

This project is easiest to verify from a fresh clone using this exact order:

```bash
git clone https://github.com/Faith-loves/blockchain-voting.git
cd blockchain-voting

cp server/.env.example server/.env
cp client/.env.example client/.env
cp chain/.env.example chain/.env  # optional
```

```bash
cd chain
npm install
npm run node
```

Open a second terminal:

```bash
cd chain
npm run deploy
```

Copy the deployed contract address printed in deploy output to:

- `server/.env` → `VOTING_CONTRACT_ADDRESS`
- `client/src/config.ts` → `CONTRACT_ADDRESS`

Open a third terminal:

```bash
cd server
npm install
npm run dev
```

Open a fourth terminal:

```bash
cd client
npm install
npm run dev
```

Then verify:

1. Open `http://localhost:5173`
2. Register a user
3. Login
4. Vote in an election
5. Open the confirmation modal and click **Verify Now**
6. On Verify page, connect MetaMask to **Localhost 8545** (chain `31337`) and click **Verify**
