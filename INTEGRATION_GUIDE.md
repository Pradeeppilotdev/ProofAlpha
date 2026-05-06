# GhostNet + ProofAlpha 0G Integration Guide

## What Was Done

ProofAlpha has been **fully integrated** into GhostNet's watcher. Now when coordination clusters are detected, they're automatically:

1. **Serialized** into proof bundles
2. **Uploaded** to 0G Storage (permanent, verifiable)
3. **Anchored** on 0G Chain via CoordinationRegistry contract
4. **Reported** with proof links in Telegram alerts

---

## Files Modified

### 1. **`src/monitor/watcher.js`**
   - **Added**: ProofAlpha orchestrator import & initialization
   - **Added**: `submitClustersToProofAlpha()` method
   - **Added**: Automatic cluster submission after detection
   - **Added**: Proof stats tracking (submitted, failed, cached)
   - **Added**: Proof link retrieval methods
   - **Modified**: `start()` method to initialize ProofAlpha
   - **Modified**: `getStatus()` to include proof stats

### 2. **`src/monitor/telegram.js`**
   - **Modified**: `sendStartup()` to show ProofAlpha status
   - **Modified**: `sendCycleSummary()` to include:
     - Proof submission stats
     - Latest proof links with explorer URLs
     - Visual indicators for 0G integration

### 3. **`.env.example`**
   - **Added**: 0G configuration template
   - **Added**: Setup instructions for ProofAlpha

---

## How It Works Now

### Workflow

```
GhostNet Cycle Runs
        ↓
Detects Coordination Clusters
        ↓
ProofAlpha.submitClustersToProofAlpha()
    ├─ Transform cluster → proof bundle
    ├─ Upload to 0G Storage → storageRoot
    ├─ Submit to CoordinationRegistry → txHash
    └─ Cache proof link
        ↓
Telegram Alert
    ├─ Report cluster
    ├─ Show storage hash
    ├─ Link to 0G explorer
    └─ Update proof stats
        ↓
Dashboard
    └─ Display latest proofs with links
```

### Example Flow

When GhostNet detects a coordination cluster:

```javascript
// Cluster detected with 3 wallets, strength 2
const cluster = {
  counterparty: "0x742d35Cc...",
  connectedWallets: ["0x111...", "0x222...", "0x333..."],
  strength: 2
}

// ProofAlpha automatically transforms this to:
{
  detectedAt: 1714982400000,
  signalType: 'COORDINATED_WALLETS',
  chainSource: 'ethereum',
  wallets: ["0x111...", "0x222...", "0x333..."],
  riskScore: 40  // (strength * 20)
}

// Uploads to 0G Storage
storageRoot = "0x8f2a7b5c..."

// Submits to contract
txHash = "0xd4e9f123..."

// Proof now queryable on-chain:
// https://chainscan-galileo.0g.ai/tx/{txHash}
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

### 3. Get Testnet Tokens

Visit https://faucet.0g.ai and claim 0.1 0G tokens.

### 4. Deploy Contract

```bash
# Add your private key to .env first
DEPLOYER_PRIVATE_KEY=0x...

# Deploy
npm run deploy:contract

# Save the address:
COORDINATION_REGISTRY_ADDRESS=0x...
```

### 5. Start Watcher

```bash
npm start
```

You should see:

```
👻 GhostNet Watcher starting...
[Watcher] 🚀 Initializing ProofAlpha (0G)...
[Watcher] ✅ ProofAlpha ready
```

### 6. Check Telegram Alerts

When clusters are detected, you'll see:

```
👻 GHOSTNET CYCLE COMPLETE

📡 Chain: ethereum
...
🕸 Coordination Clusters: 2
...

🔗 ProofAlpha (0G): 2 proofs submitted, 0 failed

📋 Latest Proofs:
• Proof 0x8f2a7b5c... [View]
• Proof 0xd4e9f123... [View]
```

---

## Configuration

### Required for ProofAlpha

In `.env`:

```env
# Private key that will sign transactions (needs ~0.01 0G for gas)
DEPLOYER_PRIVATE_KEY=0x...

# Contract address after deployment
COORDINATION_REGISTRY_ADDRESS=0x...

# 0G Chain RPC (or use default testnet)
ZG_RPC_URL=https://evmrpc-testnet.0g.ai

# Use mainnet (change to 'true' for final submission)
ZG_MAINNET=false
```

### Optional Customization

```env
# How aggressive to be with proof submission
AUTO_SUBMIT_PROOFS=true

# Minimum risk score to submit
MIN_RISK_SCORE=0

# Max proofs per hour (to avoid gas limits)
MAX_PROOFS_PER_HOUR=50
```

---

## Proof Status in Dashboard

### API Endpoint

```bash
GET /api/proof/status
```

Returns:

```json
{
  "initialized": true,
  "signerAddress": "0x...",
  "registryAddress": "0x...",
  "proofsCached": 15,
  "submissionHistory": [...],
  "network": "Testnet"
}
```

### Proof Links

```bash
GET /api/proof/latest?count=10
```

Returns:

```json
{
  "count": 10,
  "proofs": [
    {
      "id": "1",
      "storageRoot": "0x8f2a...",
      "riskScore": 82,
      "clusterSize": 3,
      "signalType": "COORDINATED_WALLETS",
      "detectedAt": "2026-05-06T10:30:00Z",
      "flagged": true
    }
  ]
}
```

---

## Metrics Tracked

The watcher now tracks:

```javascript
this.proofStats = {
  submitted: 0,    // Successful proofs on-chain
  failed: 0,       // Failed proof submissions
  cached: 0        // Proofs in local cache
}
```

Access via:

```javascript
watcher.getProofStats()
// Returns: { submitted: 15, failed: 1, cached: 16 }
```

---

## Troubleshooting

### "ProofAlpha not initialized"

```
Error: Orchestrator not initialized

Fix: Ensure .env has:
  - DEPLOYER_PRIVATE_KEY
  - COORDINATION_REGISTRY_ADDRESS
```

### "Contract not deployed"

```
Error: No contract found at address

Fix: Run deployment:
  npm run deploy:contract
  
Then save address to COORDINATION_REGISTRY_ADDRESS in .env
```

### "Insufficient balance"

```
Error: Not enough 0G for gas

Fix: Get more tokens from faucet:
  https://faucet.0g.ai
```

### Proofs not appearing on-chain

```
Check the explorer:
  https://chainscan-galileo.0g.ai

Verify transaction succeeded:
  - Check watcher logs for "✅ Proof #..."
  - Check Telegram alert for proof links
```

---

## Next Steps

### For Demo (Next 30 minutes)

1. ✅ Deploy contract
2. ✅ Start watcher
3. ✅ Check Telegram alerts for proof links

### For Hackathon Submission (Next 7 days)

1. **Test with real clusters** — Run watcher for 6 hours
2. **Verify on-chain** — Check 500+ proofs on explorer
3. **Record demo video** — Show cluster → proof flow
4. **Deploy to mainnet** — Change `ZG_MAINNET=true`
5. **Submit to HackQuest** — Include contract address

### For Dashboard UI (Days 8-10)

1. Add proof card to dashboard
2. Show latest 10 proofs
3. Link to 0G explorer
4. Display proof stats

---

## Key Functions

### In Watcher

```javascript
// Manual submission (if needed)
await watcher.submitClustersToProofAlpha(clusters, chain);

// Check status
watcher.getProofStats();
// { submitted: 42, failed: 0, cached: 42 }

// Get proof links
watcher.getProofLinks(chain);
// [{storageRoot, txHash, explorer, timestamp}, ...]

// Full status
watcher.getStatus();
// { isRunning, cycleCount, chains, proofStats, proofAlphaReady, lastResults }
```

### In Telegram

```javascript
// Alerts now include:
await alerter.sendCycleSummary({
  // ... existing fields ...
  proofStats: { submitted: 10, failed: 0, cached: 10 },
  proofLinks: [{storageRoot, explorer, ...}, ...]
});
```

---

## What Judges See

On HackQuest, you'll submit:

- **Contract Address**: `https://chainscan.0g.ai/address/{address}`
- **Sample Proof Link**: `https://chainscan.0g.ai/tx/{txHash}`
- **Proof Count**: "500+ coordination proofs submitted to 0G Chain"
- **Demo Video**: Shows cluster detection → proof on-chain

---

## Success Criteria ✅

- [x] ProofAlpha integrated with GhostNet watcher
- [x] Auto-submission of clusters to 0G
- [x] Proof links in Telegram alerts
- [x] Proof stats tracking
- [ ] 100+ real proofs submitted (run watcher)
- [ ] Contract verified on explorer
- [ ] Demo video recorded
- [ ] Submitted before May 16, 2026

---

**Status**: 🚀 **INTEGRATION COMPLETE** — Ready for testing with real clusters

Last updated: May 6, 2026
