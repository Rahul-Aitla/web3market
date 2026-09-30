# Web3 AI Prompt Marketplace

A college mini project: a marketplace for AI prompts with a live LLM playground and crypto payments on Ethereum Sepolia testnet.

> Full technical plan: see `web3-ai-marketplace-buildplan.md`.
> This README is the simple, step-by-step guide. Start with Phase 0.

---

## What you need (overview)

No coding in Phase 0. You only collect free accounts and keys.

You need 2 wallets + 7 free services:

| # | What | What you get | Where to save |
|---|------|--------------|---------------|
| 1 | MetaMask burner wallet | 2 addresses: deployer + buyer | Notepad first, then `.env` |
| 2 | Sepolia test ETH (faucet) | Fake ETH in both wallets | On-chain, check on Etherscan |
| 3 | Alchemy | RPC URL for Sepolia | `SEPOLIA_RPC_URL` |
| 4 | Neon Postgres | Database URL | `DATABASE_URL` |
| 5 | Groq | API key | `GROQ_API_KEY` |
| 6 | Upstash Redis | REST URL + token | `UPSTASH_*` |
| 7 | WalletConnect Cloud | Project ID | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| 8 | Etherscan | API key for contract verify | `ETHERSCAN_API_KEY` |

---

## Phase 0 - Detailed Steps

### Step 1. Install MetaMask and make 2 accounts

1. Install MetaMask extension in Chrome.
2. Create a new wallet. This is a **burner wallet** - use only for college, never put real money in it.
3. Open MetaMask -> account menu -> Create account. Name it `deployer`.
4. Create one more account. Name it `buyer`.
5. Copy both addresses (they start with `0x...`). Keep them in Notepad.

You now have:
- `DEPLOYER_ADDRESS` = ...
- `BUYER_ADDRESS` = ...

### Step 2. Get free test money (do this TODAY)

Test money = Sepolia ETH. Price = $0. Only for testing. You need it in **both** wallets.

Faucets allow only 1 claim per day, so start now.

**Option A - Alchemy faucet (try first, no real ETH needed):**

1. Go to `alchemy.com/faucets/ethereum-sepolia`
2. Login (make free Alchemy account - you need it for Step 3 anyway).
3. Paste your `deployer` address, click `Send Me ETH`.
4. You get 0.1 Sepolia ETH. Wait 1-2 minutes.
5. Repeat with your `buyer` address. If it says "come back in 24h", use Option B for the 2nd wallet.

**Option B - Google Cloud faucet (only needs Gmail):**

1. Go to `cloud.google.com/application/web3/faucet/ethereum/sepolia`
2. Login with Google.
3. Paste address, click claim.

**Option C - Chainlink faucet (backup):**

1. Go to `faucets.chain.link/sepolia`
2. Connect MetaMask, claim 0.5 ETH.

**See money in MetaMask:**

1. MetaMask -> top-left network list -> turn on `Show test networks`.
2. Switch network to `Sepolia`.
3. You should see your balance. If you see 0, you are still on mainnet - switch to Sepolia.

**Prove it worked:**

Paste each address into `sepolia.etherscan.io`. Both must show balance, not 0.

**Common problems:**

- `Need mainnet balance` = skip that faucet. Use Alchemy or Google above.
- `Rate limited / try tomorrow` = normal. Try next faucet, don't retry same one.
- `No money after 5 min` = check you are on Sepolia network, not Ethereum mainnet.

### Step 3. Alchemy RPC URL

You already made an Alchemy account in Step 2.

1. Alchemy dashboard -> Create new app.
2. Chain = Ethereum, Network = Sepolia.
3. Open the app -> copy the `HTTPS RPC URL`.
4. Looks like: `https://eth-sepolia.g.alchemy.com/v2/...`
5. Save it as `SEPOLIA_RPC_URL`. You will paste it in 2 files later.

Test it (replace with your URL):
```bash
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' "$SEPOLIA_RPC_URL"
```
Good result: `{"jsonrpc":"2.0","id":1,"result":"0x..."}`

### Step 4. Neon database

1. Go to Neon (or Supabase). Make free account.
2. Create new Postgres project.
3. Copy the connection string. Looks like: `postgresql://user:pass@host/dbname`
4. Save as `DATABASE_URL`.

### Step 5. Groq API key

1. Go to `console.groq.com`. Login.
2. Create API key.
3. Save as `GROQ_API_KEY`.
4. Model used: `llama-3.3-70b-versatile` (set as `GROQ_MODEL`, changeable if retired).

### Step 6. Upstash Redis (for rate limiting)

1. Go to Upstash. Make free account.
2. Create new Redis database.
3. Copy `REST URL` and `REST TOKEN`.
4. Save as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### Step 7. WalletConnect Project ID (for wallet button)

1. Go to WalletConnect Cloud. Make free account.
2. Create new project.
3. Copy Project ID.
4. Save as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

### Step 8. Etherscan API key (to verify contract)

1. Go to Etherscan (Sepolia). Make free account.
2. Go to API keys page, create new key.
3. Save as `ETHERSCAN_API_KEY`.

### Step 9. Make 2 secret passwords

Run this twice in your terminal. Do not share output in chat:
```bash
openssl rand -base64 32
```
- First output = `SESSION_JWT_SECRET`
- Second output = `DOWNLOAD_TOKEN_SECRET`

### Step 10. Put everything in env files

You create these 2 files **after Phase 1** (folders `web/` and `contracts/` don't exist yet).

`web/.env` (note: `.env`, not `.env.local` - the Prisma CLI only reads `.env`):
```
DATABASE_URL=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
APP_DOMAIN=localhost:3000
SEED_SELLER_ADDRESS=your deployer address here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=
NEXT_PUBLIC_SEPOLIA_RPC_URL=same as SEPOLIA_RPC_URL below
SEPOLIA_RPC_URL=
UPLOADS_DIR=../uploads
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SESSION_JWT_SECRET=
DOWNLOAD_TOKEN_SECRET=
```

`contracts/.env`:
```
SEPOLIA_RPC_URL=same as above
DEPLOYER_PRIVATE_KEY=from MetaMask, burner only, NEVER commit
ETHERSCAN_API_KEY=
```

> Never commit `.env` files. They are already in `.gitignore`.

---

## How to know Phase 0 is done

Check all 3:

1. RPC command above returns a `result` number.
2. Both wallets show balance on `sepolia.etherscan.io`.
3. All keys are in Notepad / `.env` files, and this passes:
```bash
git check-ignore -v web/.env contracts/.env uploads
```

Then say `start phase 1` to scaffold `contracts/` + `web/` + `uploads/`.

---

## Troubleshooting

- **Faucet rate limited:** normal. Use next faucet in Step 2 list. Fund 1-2 days before demo, keep buyer wallet untouched until demo.
- **Wrong network in MetaMask:** switch to Sepolia (chainId 11155111). Mainnet balance will show 0 on Sepolia - that's expected.
- **No real crypto needed:** Sepolia ETH is worthless test money. Never send real ETH.
- **Local files only:** uploads stay on your laptop disk. Won't work on Vercel/serverless - localhost demo only, which is fine for college.

## Next phases (short map)

- Phase 1: scaffold `contracts/` + `web/` + `uploads/`
- Phase 2: smart contract + 9 tests + deploy + verify on Sepolia
- Phase 3: database schema with Prisma
- Phase 4: wallet connect + SIWE login
- Phase 5: seller upload
- Phase 6: catalog + playground
- Phase 7: buy + download
- Phase 8: polish + demo

See `web3-ai-marketplace-buildplan.md` for exact agent instructions per phase.
