# Web3 AI Prompt Marketplace - Detailed Build Plan for OpenCode

*Revised after a security/correctness review - see the "Reviewed & fixed" note at the end of each phase that changed.*

A college mini project: a marketplace for AI prompts (text, image-gen, video-gen, dev, UI/design) with a **live LLM playground** for text-output prompts and **crypto-native payments** on Ethereum Sepolia testnet.

---

## How to use this with OpenCode

1. Give the agent **one phase at a time**, as its own instruction. Each phase below is written as a self-contained block you can paste directly.
2. After each phase: run it, click through it yourself, run `npx tsc --noEmit` in `web/` and require zero errors, and check that phase's **"Definition of done"** checklist before moving on.
3. Commit to git after every phase that passes its checklist.
4. Treat `/contracts` (Solidity) and the Next.js app as separate concerns - don't let the agent touch both in the same instruction.
5. Read every diff for **Phase 2** (smart contract) and **Phase 7** (on-chain verification) yourself, line by line. These are what a viva panel actually probes.
6. If the agent proposes a different file path, package, or route param name than what's specified here, stop and make it match - several phases assume these exact names, and a mismatch (e.g. `[id]` vs `[assetId]`) breaks the next phase silently.

---

## Architecture

```
+----------------------------------------------------------------------------+
|                              NEXT.JS 16 APP                                |
|  +------------------+  +------------------+  +--------------------------+ |
|  | Marketplace &    |  | Seller Studio    |  | Live Playground          | |
|  | Catalog          |  | (upload + config)|  | (server-side Groq call)  | |
|  +------------------+  +------------------+  +--------------------------+ |
+----------------------------------------------------------------------------+
        |                        |                          |
        v                        v                          v
+----------------+     +-------------------+      +----------------------+
| Postgres        |     | Local /uploads    |      | Groq API             |
| (Neon) + Prisma |     | + signed JWT link |      | (playground LLM call)|
+----------------+     +-------------------+      +----------------------+
        ^
        | Purchase record written after on-chain verification
        |
+-------------------------------------------------------------+
| wagmi + viem + RainbowKit (wallet connect, SIWE auth)        |
+-------------------------------------------------------------+
        |
        v
+-------------------------------------------------------------+
| Marketplace.sol - deployed + verified on Sepolia testnet     |
| purchase(assetId) payable -> transfers to seller, emits event|
+-------------------------------------------------------------+
```

---

## Tech Stack & Versions

| Layer | Choice | Notes |
|---|---|---|
| Frontend/Backend | Next.js 16 (App Router) + TypeScript + React 19 | Pinned at Phase 1: `next@16.3.6`, `react@^19`. Upgraded from 14 by explicit decision — `next lint` script is dead in v16 (do not use it), `dynamic = "force-dynamic"` and route handlers work as before. |
| Styling | Tailwind CSS v4 + shadcn/ui + lucide-react | Pinned at Phase 1: `tailwindcss@^4` + `@tailwindcss/postcss`. shadcn 4.x emits v4-style CSS (`@import "tailwindcss"`, `@theme inline` tokens in `globals.css`) — do not downgrade to v3. |
| DB / ORM | PostgreSQL (Neon free tier) + Prisma 5.x | |
| Auth | `siwe` (v2) + `jose` (v5) for JWT session cookie | No third-party auth provider |
| Wallet | `wagmi` v2 + `viem` v2 + `@rainbow-me/rainbowkit` v2 + `@tanstack/react-query` (required by wagmi v2) | |
| Chain | Ethereum Sepolia testnet (chainId 11155111) | |
| Smart contract | Hardhat 2.22.x + Solidity ^0.8.24 + `@openzeppelin/contracts@^5.0.0` | **Pinned to v5** - v5 moved `ReentrancyGuard` to `utils/`, not `security/` (that's the v4 path). Do not leave this ambiguous. |
| RPC | Alchemy free tier | |
| LLM | `groq-sdk`, model from env `GROQ_MODEL` (default `llama-3.3-70b-versatile`) | Env-configurable in case the default model is retired before eval day |
| File storage | Local filesystem + JWT signed download tokens | **Localhost demo only** - ephemeral/serverless hosts (Vercel etc.) wipe local disk between requests. Fine for a college demo; call this out in the README. |
| Rate limiting | `@upstash/ratelimit` + `@upstash/redis` | Applied to `/nonce`, `/verify`, `/upload`, `/purchases/confirm`, and `/playground`, not just playground |

---

## Repository Layout

```
repo-root/
├── contracts/
│   ├── contracts/Marketplace.sol
│   ├── scripts/deploy.ts
│   ├── test/marketplace.test.ts
│   └── hardhat.config.ts
├── uploads/                       # gitignored
│   ├── private/                   # sold prompt files, never served raw
│   └── preview/                   # public preview media
└── web/                           # the Next.js app
    ├── prisma/schema.prisma
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── providers.tsx              # WagmiProvider + QueryClientProvider + RainbowKitProvider
    │   │   ├── page.tsx
    │   │   ├── marketplace/
    │   │   │   ├── page.tsx
    │   │   │   └── [slug]/page.tsx
    │   │   ├── create-asset/page.tsx
    │   │   ├── purchases/page.tsx
    │   │   └── api/
    │   │       ├── auth/nonce/route.ts
    │   │       ├── auth/verify/route.ts
    │   │       ├── auth/logout/route.ts
    │   │       ├── auth/me/route.ts
    │   │       ├── assets/upload/route.ts
    │   │       ├── assets/[assetId]/playground/route.ts
    │   │       ├── preview/[assetId]/route.ts
    │   │       ├── purchases/confirm/route.ts
    │   │       ├── purchases/[assetId]/download/route.ts
    │   │       └── download/[token]/route.ts
    │   ├── components/
    │   │   ├── asset-card.tsx
    │   │   ├── playground-panel.tsx
    │   │   ├── buy-button.tsx
    │   │   └── connect-wallet-button.tsx
    │   └── lib/
    │       ├── prisma.ts
    │       ├── session.ts
    │       ├── categories.ts
    │       ├── wagmi-config.ts
    │       ├── rate-limit.ts
    │       └── contracts/marketplaceAbi.json
    └── package.json
```

Note the route params are all `[assetId]` - no `[id]` anywhere. This was inconsistent in an earlier draft and it's a real bug risk: mismatched param names between a route file and the code that calls it fail silently or at runtime, not at compile time.

---

## Phase 0 - Accounts & Environment Checklist

Before writing code, set these up (all free) - **seven** external accounts total:

- [ ] MetaMask installed, a **fresh/burner wallet** created
- [ ] Sepolia test ETH from a faucet, into **two** wallets: deployer + a separate "test buyer"
- [ ] Alchemy account → new Sepolia app → HTTPS RPC URL
- [ ] Neon (or Supabase) Postgres project → `DATABASE_URL`
- [ ] Groq API key at console.groq.com
- [ ] Upstash Redis database → REST URL + token
- [ ] WalletConnect Cloud project → project ID
- [ ] Etherscan account → API key (for `hardhat-verify`)

### `web/.env.local` and `contracts/.env`

```
# web/.env.local
DATABASE_URL=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
APP_DOMAIN=localhost:3000          # expected SIWE domain (host[:port]); change if you ever host it
SEED_SELLER_ADDRESS=               # deployer wallet address, used only by prisma/seed.ts
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=
NEXT_PUBLIC_SEPOLIA_RPC_URL=
SEPOLIA_RPC_URL=
UPLOADS_DIR=../uploads            # resolved to an ABSOLUTE path in code - see Phase 5 note
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SESSION_JWT_SECRET=                # openssl rand -base64 32
DOWNLOAD_TOKEN_SECRET=             # openssl rand -base64 32

# contracts/.env
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=              # burner wallet only, NEVER commit this
ETHERSCAN_API_KEY=
```

**Definition of done:** your Alchemy RPC URL returns a JSON-RPC response; both wallets show nonzero Sepolia ETH on Sepolia Etherscan; all seven accounts exist and their keys are in the two `.env` files, which are confirmed `.gitignore`d.

---

## Phase 1 - Project Setup

```
Create a monorepo with two sibling top-level folders: `contracts/` and
`web/` at the repo root.

In `web/`, run create-next-app with: TypeScript, Tailwind CSS, App Router,
`src/` directory, ESLint, import alias `@/*` -> `src/*`. Initialize
shadcn/ui with: button, input, dialog, card, select, textarea, toast,
badge, tabs, skeleton, form, label. Install zod and react-hook-form.

Install Prisma as a dev dependency in web/, run `npx prisma init`,
datasource pointed at env("DATABASE_URL").

In `contracts/`, run `npx hardhat init` (TypeScript project), targeting
Solidity ^0.8.24. Install `@openzeppelin/contracts@^5.0.0` exactly (not
latest, not ^4.x) and `@nomicfoundation/hardhat-verify@2.0.0` exactly.
Version pins discovered during Phase 1 execution - do not change them:
hardhat must be exactly `2.22.19` (newer 2.x breaks the verify v2 peer
range; verify v3 needs Hardhat 3), verify must be `2.0.0` (v2.1.x needs
hardhat ^2.26), and contracts-local `typescript` must stay major v5
(ts-node 10.9 is incompatible with TS 7). Test plugins, pinned during
Phase 2 execution: `@nomicfoundation/hardhat-ethers` exactly `3.0.8` and
`@nomicfoundation/hardhat-chai-matchers` exactly `2.0.0` (later minors
need hardhat ^2.28), plus `@typechain/hardhat@^9` + `@typechain/ethers-v6`
so `npx tsc --noEmit` passes on the tests (`./typechain-types` must be in
tsconfig `include`, or the generated typings are silently ignored).

At the repo root, create `uploads/private/` and `uploads/preview/`, and
add `uploads/`, `.env`, `.env.local`, `node_modules/` to a root .gitignore.

Scaffolding only - no application logic yet.
```

**Definition of done:** `cd web && npm run dev` serves the default page; `cd contracts && npx hardhat compile` succeeds; `git status` shows `uploads/` and `.env*` ignored; `cd contracts && node -p "require('@openzeppelin/contracts/package.json').version"` prints a `5.x` version (works the same on Windows, macOS, and Linux).

---

## Phase 2 - Smart Contract (core of the project)

**Reviewed & fixed:** OpenZeppelin v5's import path, exact-payment semantics instead of `>=` (simpler to reason about and matches the frontend), an explicit sentinel-zero guard, and documented (not silently accepted) limitations around listing squatting and archiving.

```solidity
// contracts/contracts/Marketplace.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Known, deliberate limitations (documented for viva, not oversights):
// - assetId 0 is reserved as the "unlisted" sentinel. The app's onChainId
//   column must autoincrement starting at 1.
// - listAsset is first-come-first-served per assetId: anyone could in
//   theory list assetId N before its intended seller does. Mitigated at
//   the app level, not the contract level - the app calls listAsset
//   immediately after creating the DRAFT row, in the same flow, so the
//   window is seconds, not longer. A squatted id is simply abandoned;
//   the app creates a new Asset row with a fresh onChainId.
// - There is no updatePrice/unlist function. An app-level ARCHIVED
//   status is display-only: the listing remains purchasable on-chain
//   even if hidden from the catalog UI. This is a stated assumption,
//   not a bug.
// - purchase() requires the EXACT listed price (not >=), so there is no
//   overpayment-refund logic to reason about. The frontend always sends
//   exactly priceWei.
contract Marketplace is ReentrancyGuard {
    mapping(uint256 => address payable) public assetSeller;
    mapping(uint256 => uint256) public assetPrice; // price in wei
    mapping(uint256 => mapping(address => bool)) public hasPurchased;

    event AssetListed(uint256 indexed assetId, address indexed seller, uint256 price);
    event Purchased(uint256 indexed assetId, address indexed buyer, address indexed seller, uint256 amount, uint256 timestamp);

    function listAsset(uint256 assetId, uint256 priceWei) external {
        require(assetId != 0, "assetId 0 is reserved");
        require(assetSeller[assetId] == address(0), "Already listed");
        require(priceWei > 0, "Price must be > 0");
        assetSeller[assetId] = payable(msg.sender);
        assetPrice[assetId] = priceWei;
        emit AssetListed(assetId, msg.sender, priceWei);
    }

    function purchase(uint256 assetId) external payable nonReentrant {
        address payable seller = assetSeller[assetId];
        require(seller != address(0), "Not listed");
        require(msg.value == assetPrice[assetId], "Incorrect payment amount");
        require(!hasPurchased[assetId][msg.sender], "Already purchased");

        hasPurchased[assetId][msg.sender] = true;

        (bool sent, ) = seller.call{value: msg.value}("");
        require(sent, "Transfer to seller failed");

        emit Purchased(assetId, msg.sender, seller, msg.value, block.timestamp);
    }
}
```

```
Place the contract above at contracts/contracts/Marketplace.sol exactly
as given - do not modify its logic.

Write contracts/test/marketplace.test.ts covering, one `it(...)` each:
1. lists an asset and emits AssetListed
2. reverts listing assetId 0 ("assetId 0 is reserved")
3. reverts listing the same assetId twice ("Already listed")
4. reverts listing with price 0 ("Price must be > 0")
5. reverts purchase when value is under the listed price
6. reverts purchase when value is over the listed price (overpayment
   must revert now, not succeed)
7. transfers funds to the seller and emits Purchased on exact payment
   (assert seller balance change equals the sent value; assert event args)
8. reverts if the same buyer purchases the same asset twice
9. reverts when purchasing an assetId that was never listed

Write contracts/hardhat.config.ts reading SEPOLIA_RPC_URL and
DEPLOYER_PRIVATE_KEY from contracts/.env, a `sepolia` network entry using
them. Configure @nomicfoundation/hardhat-verify using the Etherscan v2
config shape - `etherscan.apiKey` as an OBJECT keyed by network name
(e.g. `{ sepolia: process.env.ETHERSCAN_API_KEY }`), not a bare string.
The old single-string config silently fails to verify under the current
Etherscan v2 API on some networks.

Write contracts/scripts/deploy.ts: deploy Marketplace with no constructor
args, wait for the deploy tx to be mined, and log:
  DEPLOYED_ADDRESS=0x...
```

Run and deploy yourself:

```bash
cd contracts
npx hardhat test
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```

Copy the address into `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS`; copy the ABI array into `web/src/lib/contracts/marketplaceAbi.json`.

**Definition of done:** all 9 tests pass locally; contract verified on Sepolia Etherscan; `npx tsc --noEmit` (in contracts, if applicable) and `npx hardhat compile` both clean.

---

## Phase 3 - Database Schema

**Reviewed & fixed:** `onChainId` moved in from the start (was previously bolted on in Phase 5, which would have meant altering a table with live data). `Review` now has a uniqueness constraint. `Purchase.blockNumber` uses `BigInt` rather than `Int` (Sepolia block numbers will eventually exceed 32-bit range). `User.nonce` is optional to make first-login upsert straightforward.

```prisma
// web/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Category {
  TEXT_PROMPT
  IMAGE_PROMPT
  VIDEO_PROMPT
  CODE_DEV_PROMPT
  UI_DESIGN_PROMPT
  SYSTEM_PROMPT
  N8N_BLUEPRINT
  MAKE_AUTOMATION
  CREWAI_SCRIPT
  LANGCHAIN_PIPELINE
  MCP_SERVER
  CURSOR_RULES
}

enum PreviewMediaType {
  NONE
  IMAGE
  VIDEO
}

enum AssetStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum PurchaseStatus {
  PENDING
  CONFIRMED
  FAILED
}

model User {
  id            String   @id @default(cuid())
  walletAddress String   @unique  // always stored lowercase
  nonce         String?          // set on each /nonce call; null before first login
  username      String?  @unique
  createdAt     DateTime @default(now())

  assets    Asset[]    @relation("SellerAssets")
  purchases Purchase[]
  reviews   Review[]
}

model Asset {
  id               String           @id @default(cuid())
  onChainId        Int              @unique @default(autoincrement())
  // NOTE: Prisma autoincrement starts at 1 by default. This is required,
  // not incidental - the contract treats onChainId 0 as "unlisted".
  // Never write logic (seeding, tests) that could produce onChainId 0.
  sellerId         String
  seller           User             @relation("SellerAssets", fields: [sellerId], references: [id])
  title            String
  slug             String           @unique
  shortDesc        String
  fullDesc         String           @db.Text
  category         Category
  priceWei         String           // BigInt as string; parse with BigInt() / viem helpers in app code
  status           AssetStatus      @default(DRAFT)

  fileStoragePath  String           // sold prompt file - gated, never public
  fileType         String
  fileSizeBytes    Int

  previewMediaType PreviewMediaType @default(NONE)
  previewMediaPath String?          // public sample output, NOT gated

  playgroundConfig Json?            // { inputs: [{name,label}], systemPrompt } (model always comes from server env GROQ_MODEL)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  purchases Purchase[]
  reviews   Review[]

  @@index([category, status])
}

model Purchase {
  id          String         @id @default(cuid())
  buyerId     String
  buyer       User           @relation(fields: [buyerId], references: [id])
  assetId     String
  asset       Asset          @relation(fields: [assetId], references: [id])
  txHash      String         @unique
  amountWei   String
  status      PurchaseStatus @default(PENDING)
  blockNumber BigInt?
  createdAt   DateTime       @default(now())

  @@unique([buyerId, assetId])
}

model Review {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  assetId   String
  asset     Asset    @relation(fields: [assetId], references: [id])
  rating    Int      // enforce 1-5 with zod at the API layer; Prisma can't range-check
  comment   String?  @db.Text
  createdAt DateTime @default(now())

  @@unique([userId, assetId])  // one review per buyer per asset
}
```

```
Place the schema above at web/prisma/schema.prisma exactly as given. Run
`npx prisma db push`, then `npx prisma generate`.

Create web/src/lib/prisma.ts: a singleton PrismaClient using the standard
Next.js dev global-caching pattern.

Create web/src/lib/categories.ts exporting CATEGORY_LABELS (Record
mapping each Category to a human label), PLAYGROUND_ELIGIBLE (array:
TEXT_PROMPT, SYSTEM_PROMPT, CODE_DEV_PROMPT, CURSOR_RULES, MCP_SERVER),
and isPlaygroundEligible(category).

Whenever BigInt values (blockNumber) are returned from an API route as
JSON, convert them to strings first - JSON.stringify throws on raw
BigInt values.
```

**Definition of done:** `npx prisma studio` shows all five tables with correct columns and types (`onChainId` as Int, `blockNumber` as BigInt); creating two Assets in Studio manually shows `onChainId` auto-assigned as 1, then 2.

---

## Phase 4 - Wallet Connect & SIWE Auth

**Reviewed & fixed:** the SIWE message is now actually verified against `domain`, `uri`, `chainId`, and expiration (not just signature + nonce, which alone doesn't stop a signature from another dapp being replayed here). Added a `/logout` route and account-switch detection. Added rate limiting on `/nonce` and `/verify`. Added the missing `@tanstack/react-query` dependency and `ssr: true` in the wagmi config (both required for App Router, and easy for an agent to silently omit).

```
Install wagmi, viem, @rainbow-me/rainbowkit, siwe, jose, and
@tanstack/react-query in web/.

Create web/src/lib/wagmi-config.ts: a wagmi config from RainbowKit's
getDefaultConfig, with appName "AI Prompt Marketplace", projectId from
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, chains: [sepolia] only, a custom
transport for sepolia using NEXT_PUBLIC_SEPOLIA_RPC_URL via viem's
http(), and `ssr: true` (required for the App Router - omitting it
causes hydration mismatches).

Create web/src/app/providers.tsx (client component): wrap children in
WagmiProvider (config above), a TanStack QueryClientProvider (required
by wagmi v2 - the app will fail to compile/run without this even though
it's easy to forget), and RainbowKitProvider. Use it in
web/src/app/layout.tsx.

Add RainbowKit's <ConnectButton /> in the navbar directly.

Build SIWE exactly as follows:

1. GET /api/auth/nonce - rate-limited via @upstash/ratelimit, 10/min per
   IP. Generate a nonce with siwe's generateNonce(), set it in an
   httpOnly, sameSite=lax, path=/ cookie `siwe_nonce` (5 min expiry, secure when NODE_ENV is production), return
   { nonce }.

2. Client: on connect, fetch the nonce, build a SiweMessage with:
   domain = window.location.host, address (from useAccount, as-is -
   don't lowercase on the client), statement "Sign in to AI Prompt
   Marketplace", uri = window.location.origin, version "1",
   chainId 11155111, nonce, and expirationTime = 5 minutes from now
   (SiweMessage accepts this as an ISO string). Call
   message.prepareMessage(), sign with wagmi's useSignMessage.

3. POST /api/auth/verify - rate-limited, 10/min per IP. Body:
   { message: string, signature: string }.
   - read `siwe_nonce` cookie; 400 if missing
   - construct SiweMessage(body.message), call
     .verify({ signature, nonce: cookieNonce, domain: expectedHost (derive it from the request's Host header, or from an APP_DOMAIN env var; never hardcode localhost),
     time: new Date().toISOString() }) - passing `domain` here is what
     actually enforces the domain check; verify() alone does not bind
     it unless you pass it explicitly
   - reject (401) if verification fails, OR if the parsed message's
     chainId !== 11155111, OR if message.expirationTime has passed
   - lowercase the recovered address before any DB lookup/comparison
   - upsert User by walletAddress (lowercased); if creating, also set
     a fresh nonce; if updating, rotate nonce
   - sign a JWT (jose SignJWT) { sub: user.id, walletAddress
     (lowercased) }, 7 day expiry, secret SESSION_JWT_SECRET
   - set httpOnly, sameSite=lax, path=/ cookie `session` (7 day maxAge, secure when NODE_ENV is production)
   - clear `siwe_nonce`
   - return { walletAddress, userId }

4. POST /api/auth/logout: clear the `session` cookie, return 200.

5. Create web/src/lib/session.ts:
     getSessionUser(): Promise<{ userId: string; walletAddress: string } | null>
   reads/verifies the `session` cookie via jose's jwtVerify, returns null
   on any failure rather than throwing.

6. In the navbar (client component), watch wagmi's useAccount().address.
   If it changes to a value that doesn't match the current session's
   walletAddress (fetch it once on mount from GET /api/auth/me, defined in step 7), call /api/auth/logout and prompt re-sign-in - otherwise
   a MetaMask account switch leaves a stale session pointing at the old
   address while the UI shows the new one connected.

7. GET /api/auth/me (web/src/app/api/auth/me/route.ts): call
   getSessionUser(); return { walletAddress, userId } with 200, or
   { walletAddress: null } with 200 when there is no valid session (not
   a 401, so the navbar can poll it without console errors).

8. In create-asset/page.tsx and purchases/page.tsx (server components),
   call getSessionUser() and redirect to "/?needsWallet=1" if null.
```

**Definition of done:** connecting and signing sets a `session` cookie; switching accounts in MetaMask without re-signing triggers a forced logout/re-sign prompt rather than silently acting as the old wallet; a signed SIWE message with the wrong `chainId` or an expired one is rejected with 401; hitting `/api/auth/verify` 11 times in a minute gets rate-limited.

---

## Phase 5 - Seller Upload & Asset Management

**Reviewed & fixed:** removed the unnecessary `uuid` dependency in favor of native `crypto.randomUUID()`. Resolved the preview-required contradiction - it's now enforced in one place (the server action), not vaguely in "the UI but also maybe the server." Price is now taken as a string and parsed with `parseEther` directly, avoiding the float-precision loss from `z.coerce.number()`. Added rate limiting on the upload route and a note on orphaned files.

```
Install `zod` and `slugify` in web/. Do NOT install `uuid` - use the
native `crypto.randomUUID()` (Node 19+ / all modern runtimes).

Build POST /api/assets/upload:
- require a session; 401 if absent
- rate-limit: 20/min per user (keyed by session userId)
- parse as multipart via `await request.formData()`
- two possible files: `promptFile` (required) and `previewMedia`
  (optional)
- validate promptFile: extension .txt/.md/.json, size < 1MB. Check the
  extension AND sniff the first few bytes to confirm it's plausible text
  (e.g. reject if the buffer contains null bytes, which text files
  never do) - extension-only validation is trivially spoofed
- validate previewMedia if present: image .jpg/.jpeg/.png/.webp < 5MB,
  or video .mp4/.webm < 20MB; same sniff-check spirit (check for the
  file's magic-byte signature, e.g. PNG's 8-byte header, rather than
  trusting the extension alone) - a simple check is enough for a mini
  project, doesn't need to be exhaustive
- write promptFile to `${resolvedUploadsDir}/private/${crypto.randomUUID()}.${ext}`,
  previewMedia to `${resolvedUploadsDir}/preview/${crypto.randomUUID()}.${ext}`
- IMPORTANT: resolve UPLOADS_DIR to an absolute path in code -
  `path.resolve(process.cwd(), process.env.UPLOADS_DIR!)` - never use
  the env value as a relative path directly, since its meaning depends
  on process.cwd() at runtime and will break under some deploy/run
  configurations
- return { promptFilePath, promptFileType, promptFileSizeBytes,
  previewMediaPath?, previewMediaType? } (paths relative to
  resolvedUploadsDir, for storing on the Asset row - not full disk paths)
- note for your own understanding, not something to fix now: if a user
  uploads files then abandons the form before submitting, those files
  are orphaned (never referenced by an Asset row) - acceptable for a
  mini project; a cleanup cron is a stretch goal, not required

Build web/src/app/create-asset/page.tsx with react-hook-form + zod:

  const assetSchema = z.object({
    title: z.string().min(3).max(120),
    shortDesc: z.string().min(10).max(160),
    fullDesc: z.string().min(20).max(4000),
    category: z.nativeEnum(Category),
    priceEth: z.string().regex(/^\d+(\.\d+)?$/, "Enter a valid amount"),
  });

Parse priceEth to wei with viem's parseEther(values.priceEth) directly -
never round-trip it through a JS number, which loses precision on
fractional ETH amounts.

Fields: title, short/full description, category (Select from
CATEGORY_LABELS), price in ETH (text input, validated as above), the
prompt file input, then conditionally:
  - isPlaygroundEligible(category): a repeatable { name, label } input
    list, and a system prompt textarea (no model field: the server always uses
    GROQ_MODEL). Helper text under the textarea: "Refer to your inputs by
    name in plain language. No {{placeholder}} substitution is performed."
  - else: the preview media file input

On submit:
1. POST files to /api/assets/upload
2. Call a server action `createAsset(input)` (file: web/src/app/create-asset/actions.ts, marked "use server") that:
   - re-requires a session and validates the submitted file paths: promptFilePath
     must resolve (after path.resolve + basename check) to an existing file
     under resolvedUploadsDir/private, and previewMediaPath (if any) to an
     existing file under resolvedUploadsDir/preview; reject otherwise so a
     client cannot submit fake or traversal paths without uploading
   - enforces the preview-required rule server-side, in exactly one
     place: `if ([Category.IMAGE_PROMPT, Category.VIDEO_PROMPT,
     Category.UI_DESIGN_PROMPT].includes(category) && !previewMediaPath)
     throw new Error("Preview media is required for this category")`
   - creates the Asset row, status DRAFT, slug = slugify(title) + "-" +
     a short random suffix; on a P2002 unique-constraint error on slug,
     retry once with a new random suffix before giving up
3. Show "Publish on-chain": call the Marketplace contract's
   listAsset(BigInt(asset.onChainId), BigInt(asset.priceWei)) via
   wagmi's useWriteContract
4. useWaitForTransactionReceipt to await confirmation, then a server
   action flips status to PUBLISHED - never mark PUBLISHED before this
   confirms
```

**Definition of done:** submitting writes exactly the expected file(s) under `uploads/`; a `.exe` renamed to `.txt` is still rejected (magic-byte check catches it, not just the extension); creating two assets back-to-back with the same title produces two different slugs; an `IMAGE_PROMPT` asset submitted with no preview media is rejected with a clear error, not silently accepted.

---

## Phase 6 - Marketplace Catalog & Live Playground

**Reviewed & fixed:** route renamed to `/api/assets/[assetId]/playground` for consistency. Added `force-dynamic` + pagination to the catalog (otherwise newly published assets won't appear due to static caching, and the page breaks past ~50 assets). Playground rate limiting now keys on session userId first, IP as fallback only (an IP-only limit means an entire classroom on one NAT shares one quota). Groq call now sends the system prompt as an actual system message and the user's values as a user message (more defensible than stuffing everything into `system`). Added an explicit, honest note that prompt secrecy is best-effort against injection, since a determined user can often coax a model into revealing its instructions.

```
Build src/app/marketplace/page.tsx (server component):
- add `export const dynamic = "force-dynamic"` at the top - without
  this, the App Router may statically cache this page and newly
  PUBLISHED assets won't show up until a rebuild
- read `category`, `q` (search), and `page` (default 1) from
  searchParams
- query PUBLISHED assets with Prisma: filter by category/search if
  present, `take: 24`, `skip: (page-1)*24`, ordered by createdAt desc
- `select` explicitly: id, slug, title, shortDesc, category, priceWei,
  previewMediaType, previewMediaPath, createdAt - never include
  fileStoragePath or playgroundConfig here
- render category chips (from CATEGORY_LABELS), a grid of <AssetCard>,
  and simple prev/next page links

Build src/components/asset-card.tsx: title, shortDesc, category badge,
price (viem's formatEther(BigInt(priceWei))). If previewMediaType !==
"NONE", show a thumbnail (<img> for IMAGE, muted looping <video> for
VIDEO) pointed at /api/preview/${assetId}.

Build GET /api/preview/[assetId] (public, no auth):
- 404 if the asset doesn't exist or previewMediaType is NONE
- stream the file from resolvedUploadsDir/preview/<basename of
  previewMediaPath> with Content-Type set from the extension
- for VIDEO, support HTTP Range requests (parse the Range header,
  respond 206 with the requested byte range) - without this, <video>
  seeking works poorly; acceptable to skip for a first pass, but note
  it as a known limitation if skipped
- never read from the private/ folder here, under any circumstance

Build src/app/marketplace/[slug]/page.tsx (server component):
- add `export const dynamic = "force-dynamic"` at the top
- fetch the Asset by slug on the server. Whatever is passed to client
  components or rendered must come from the excluding `select`; if the
  playground needs its inputs, read playgroundConfig on the server (it
  never leaves the server) and pass only `.inputs` down
- if isPlaygroundEligible(category): render
  <PlaygroundPanel assetId={asset.id} inputs={asset.playgroundConfig.inputs} />
  - pass ONLY .inputs, never .systemPrompt, into this client component
- else: render the preview media large
- below either: <BuyButton /> (Phase 7) and existing reviews

Build src/components/playground-panel.tsx (client): one text input per
{ name, label } in inputs; on submit POST to
/api/assets/[assetId]/playground with { values: Record<string,string> };
show a loading skeleton, then render the returned output as plain text.

Build POST /api/assets/[assetId]/playground:
- rate limit: prefer session userId as the key if a session exists,
  else fall back to IP (x-forwarded-for, or a constant in local dev);
  5 requests per 60 seconds; 429 on exceeding
- load playgroundConfig directly from Prisma inside this handler only -
  never pass it through a prop, never log it, never include it in any
  response body including error responses
- 400 if the asset's category is not playground-eligible
- build messages: [{ role: "system", content: playgroundConfig.systemPrompt },
  { role: "user", content: <the user's submitted values, rendered as
  "{name} ({label}): {value}" lines> }] - do NOT rely solely on {{name}}
  substitution inside the system message; sending the user's values as
  an actual user turn is both simpler and more in line with how these
  models are normally used
- there is NO {{name}} substitution anywhere: the system prompt is sent
  exactly as the seller wrote it, and the user's values travel only in
  the user turn
- call groq-sdk's chat.completions.create with model: process.env.GROQ_MODEL
  (ignore any seller-supplied model so sellers cannot pick arbitrary or
  expensive models), max_tokens: 512
- wrap the call in try/catch; on any Groq failure (retired model, rate
  limit, network) return 502 { error: "Model unavailable, try again" }
  and log only the error message server-side, never the system prompt
- return { output: string } only
- be aware (and say so if asked in viva): this is best-effort secrecy.
  A sufficiently motivated user can sometimes coax the model into
  revealing its system prompt via prompt injection. There is no fully
  reliable server-side defense against this with a plain chat
  completion call; acknowledge it rather than claim the prompt is
  perfectly hidden.
```

**Definition of done:** publishing a new asset appears in the catalog without a rebuild; requesting page 3 of a category with fewer than 48 assets returns an empty-but-not-broken page; 6 playground submissions within a minute from the same logged-in user get rate-limited even across different IPs (e.g. wifi vs mobile hotspot) - verifying the key is userId, not just IP.

---

## Phase 7 - On-Chain Purchase & Download Delivery

**Reviewed & fixed:** this is the big one. The original `/confirm` spec had a real exploit - it checked "does this txHash already have a Purchase row" but never checked *whose* row it was, so an attacker who observes a victim's public txHash on Sepolia could POST it under their own session first and take the download. Fixed by binding the on-chain event's `buyer` to the session wallet before any idempotency check, and by checking the paid amount against the asset's price. Also hardened `decodeEventLog` usage (filter by contract address, try/catch per log) and added proper headers to the download response.

```
Build src/components/buy-button.tsx, given assetId, onChainId, priceWei:
1. Not connected: "Connect wallet to buy" (opens RainbowKit modal)
2. Connected, wrong chain: "Switch to Sepolia" (wagmi useSwitchChain)
3. Connected, insufficient balance (check useBalance({ address, chainId: sepolia.id }) against
   BigInt(priceWei)): disable the button with a tooltip "Not enough
   Sepolia ETH"
4. Otherwise: "Buy for {formatEther(priceWei)} ETH". On click,
   useWriteContract: functionName "purchase", args [BigInt(onChainId)],
   value: BigInt(priceWei)
5. Toast "Waiting for confirmation..." during
   useWaitForTransactionReceipt
6. On confirmation: POST /api/purchases/confirm { assetId, txHash },
   then redirect to /purchases on success
7. On wallet rejection or contract revert, surface the actual revert
   reason (viem error's shortMessage), not a generic "Error"

Build POST /api/purchases/confirm:
- rate-limit: 10/min per user (each call costs RPC quota)
- require a session; the buyer's wallet address is ALWAYS taken from
  the session, never from the request body
- use viem's createPublicClient (transport http(SEPOLIA_RPC_URL)),
  call getTransactionReceipt({ hash: txHash })
- verify receipt.status === "success" and receipt.to (lowercased)
  equals the marketplace contract address (lowercased)
- filter receipt.logs to only those where log.address (lowercased)
  equals the contract address BEFORE attempting to decode anything -
  decodeEventLog throws on logs from unrelated contracts/events, so
  decoding an unfiltered list will crash on the first unrelated log
- for each remaining log, try/catch a decodeEventLog call against the
  Purchased event ABI; collect successfully decoded matches
- from the decoded Purchased log(s), require exactly one match where
  args.assetId === BigInt(asset.onChainId) AND args.buyer (lowercased)
  === session.walletAddress (lowercased); if none match, 400
  { error: "Transaction does not match this purchase" } and do NOT
  write a Purchase row
- require args.amount === BigInt(asset.priceWei) (the contract enforces
  exact payment, so this should always hold if the tx is genuinely a
  purchase of this asset - treat a mismatch as suspicious and reject)
- THEN check idempotency: if a Purchase with this txHash already
  exists -
    - if its buyerId matches the current session's user, return its
      existing status (safe retry)
    - if its buyerId does NOT match, return 400
      { error: "This transaction is already associated with a
      different purchase" } - do NOT silently succeed
- on a genuinely new, verified purchase: create the Purchase row,
  status CONFIRMED, amountWei from the decoded log, blockNumber from
  receipt.blockNumber (this is a BigInt - store directly, and when
  returning it in any JSON response, convert to a string first)
- return { status: "CONFIRMED" }

Build src/app/purchases/page.tsx (with `export const dynamic = "force-dynamic"`): require a session; list this user's
CONFIRMED purchases joined to their Asset; each row has a "Download"
button.

Build GET /api/purchases/[assetId]/download:
- require a session
- verify a CONFIRMED Purchase exists for (session wallet, this
  assetId); 404 if not
- issue a JWT (jose SignJWT), payload { assetId, walletAddress }, 5 min
  expiry, secret DOWNLOAD_TOKEN_SECRET
- return { downloadUrl: "/api/download/" + token }

Build GET /api/download/[token]:
- verify/decode the JWT; 403 on any failure (expired, malformed, wrong
  signature)
- re-check a CONFIRMED Purchase still exists for the decoded
  assetId/walletAddress pair
- stream resolvedUploadsDir/private/<basename of fileStoragePath> with:
  Content-Type: from asset.fileType
  Content-Disposition: attachment; filename="<slugified title>.<ext>"
  Content-Length: <file size in bytes>
  Cache-Control: no-store
```

**Definition of done:** attempting to POST `/api/purchases/confirm` with a real Sepolia txHash that belongs to *someone else's* purchase, under your own session, returns 400 and creates no row (this is the exploit from the review - test it explicitly, don't just assume the fix works); buying an already-owned asset reverts on-chain with "Already purchased" and the UI shows that reason; a download link used after 6 minutes returns 403; the downloaded file's bytes match what the seller uploaded, never the preview media.

---

## Phase 8 - Polish & Demo Readiness

```
Add specific error/empty states (not a generic error boundary):
- wrong network anywhere a contract call is needed: "Switch to Sepolia"
- insufficient balance: disable Buy with a tooltip, checked before
  submission, not after a failed tx
- wallet disconnected mid-flow: detect via useAccount().isConnected,
  show a reconnect prompt instead of a stuck spinner
- empty marketplace / no search results: a real empty state

Add a review form on the purchases page: 1-5 star rating (zod
z.number().int().min(1).max(5)) + optional comment, submitted via a
server action in web/src/app/purchases/actions.ts ("use server") that
verifies a CONFIRMED purchase exists AND that
the @@unique([userId, assetId]) constraint from Phase 3 will reject a
second review from the same buyer on the same asset - surface that as
a friendly "you've already reviewed this" rather than a raw DB error.

Add demo seed data so the demo does not depend on faucet or mempool luck:
- web/prisma/seed.ts (register it under "prisma": { "seed": ... } in
  web/package.json): upsert a User for SEED_SELLER_ADDRESS (lowercased),
  then create 1 TEXT_PROMPT asset (with playgroundConfig) and 1
  IMAGE_PROMPT asset (with a small sample image in uploads/preview and
  prompt text files in uploads/private), status PUBLISHED, with fixed
  prices. (Deliberate exception to the never-PUBLISHED-before-on-chain
  rule: these rows only become purchasable once seed-list.ts runs, and
  only the deployer controls both steps.) Write their onChainId and priceWei to seed/seed-assets.json at
  the repo root.
- contracts/scripts/seed-list.ts: read seed/seed-assets.json (resolve it with
  path.resolve(__dirname, "../../seed/seed-assets.json"), not a bare
  relative path) and call
  listAsset(onChainId, priceWei) for each entry from the deployer wallet
  (which must be the same address as SEED_SELLER_ADDRESS).
- Run order: prisma db seed, then
  `npx hardhat run scripts/seed-list.ts --network sepolia`, a day before
  the demo.

Write README.md covering: prerequisites, every env var with a one-line
description, contract test/deploy/verify commands, how to run web/
locally, and a troubleshooting section including "faucet rate limited",
"wrong network in MetaMask", and an explicit note that file storage is
local-disk only and won't survive a serverless deployment.
```

### Demo script for evaluation day

1. Connect wallet, show it's on Sepolia
2. Browse the catalog, filter by category, open a `TEXT_PROMPT` asset, run the Live Playground
3. Open an `IMAGE_PROMPT` asset, show the static preview instead
4. Buy Now, confirm in MetaMask, watch pending → confirmed
5. Open the tx on Sepolia Etherscan, point out the `Purchased` event log
6. Purchases page, download, open the file to confirm it matches the listing
7. Leave a review; try leaving a second one to show the unique-constraint rejection
8. Open the verified contract source on Etherscan and walk through `purchase()` - including the exact-payment and squatting-mitigation design choices, since those are exactly what a reviewer would ask about

---

## Known Limitations (say these in viva before they are asked)

- **SIWE statement and uri** are set by the client and not re-checked server-side. Domain, chainId, nonce, and expiry are what bind the signature to this app, so replay from another dapp fails; the statement is cosmetic.
- **User.nonce in the DB** is rotated but the cookie nonce is what gets verified. Fine because the cookie is httpOnly and short-lived; a stricter version would compare against the DB value too.
- **PurchaseStatus.PENDING and FAILED** are unused: /confirm only writes a row after full on-chain verification, so rows are born CONFIRMED. The extra enum values are reserved for a future background listener.
- **Revert strings in tests 5 and 6**: pin both to "Incorrect payment amount" when writing the tests.
- **promptFileType** should be derived from the validated extension (.txt -> text/plain, .md -> text/markdown, .json -> application/json), not from the client-supplied MIME type, since it becomes the download Content-Type.
- **Gas**: the Buy button checks balance against the price only, not price plus gas. A buyer with barely enough ETH may see MetaMask reject the tx; the revert/rejection toast covers this.
- **Storage** is local disk, so this is a localhost demo only.

## Stretch Goals (only once Phase 0–8 is solid, with time to spare)

- **Escrow instead of direct transfer**: hold funds in the contract; add `confirmDelivery(assetId)` for the buyer to release funds after downloading.
- **ERC-20 stablecoin payments** on Sepolia instead of raw ETH.
- **On-chain event listener** as a second source of truth alongside frontend-submitted `txHash`.
- **Chainlink price feed** for a live ETH/USD display.
- **Live image/video generation previews** via a free tier of fal.ai or Stability AI, replacing the static preview.
- **Range-request support** on the preview route if skipped in Phase 6.
- **Orphaned-upload cleanup** job for files never attached to a submitted Asset.