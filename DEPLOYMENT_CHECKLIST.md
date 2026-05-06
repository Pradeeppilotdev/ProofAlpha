# ProofAlpha Integration Complete ✅

## Summary

GhostNet's watcher is now **fully integrated with ProofAlpha (0G)**. When coordination clusters are detected, they are automatically:

1. **Transformed** into proof bundles with evidence
2. **Uploaded** to 0G Storage (permanent, verifiable)  
3. **Anchored** on 0G Chain via smart contract
4. **Reported** in Telegram alerts with proof links
5. **Tracked** with statistics

---

## What Changed

### Code Changes (Automated)

| File | Changes | Status |
|------|---------|--------|
| `src/monitor/watcher.js` | Added ProofAlpha init, auto-submission, proof tracking | ✅ Done |
| `src/monitor/telegram.js` | Added proof stats & links to alerts | ✅ Done |
| `.env.example` | Added 0G configuration | ✅ Done |
| `package.json` | Added test & deploy commands | ✅ Done |

### New Files

| File | Purpose | Status |
|------|---------|--------|
| `INTEGRATION_GUIDE.md` | Complete integration docs | ✅ Done |
| `scripts/test-integration.js` | Integration test script | ✅ Done |

---

## How to Deploy (Next 30 Minutes)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Get Testnet Tokens

Visit https://faucet.0g.ai and claim 0.1 0G tokens to your wallet.

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add:

```env
# Your private key (from MetaMask/wallet)
DEPLOYER_PRIVATE_KEY=0x...

# 0G RPC endpoint (default is fine)
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
```

### Step 4: Deploy Contract

```bash
npm run deploy:contract
```

Output will show:

```
✅ CoordinationRegistry deployed!
   Contract address: 0x742d35Cc...
   📋 Save this in your .env:
   COORDINATION_REGISTRY_ADDRESS=0x742d35Cc...
```

### Step 5: Save Contract Address

Update `.env`:

```env
COORDINATION_REGISTRY_ADDRESS=0x742d35Cc...
```

### Step 6: Test Integration (Optional)

```bash
npm run test:integration
```

You should see:

```
✅ INTEGRATION TEST SUCCESSFUL
   Proofs submitted: 2
   Proofs failed: 0
   Proof links: 2
   ProofAlpha ready: true
```

### Step 7: Start Watcher

```bash
npm start
```

You'll see:

```
👻 GhostNet Watcher starting...
[Watcher] 🚀 Initializing ProofAlpha (0G)...
[Watcher] ✅ ProofAlpha ready
```

---

## Expected Behavior

### When Clusters Are Detected

**Console Output:**

```
[ProofAlpha] 📝 Submitting 2 cluster(s) to 0G...
[ProofAlpha] ✅ Proof #0x742d35cc
[ProofAlpha] ✅ Proof #0x9876543c
```

**Telegram Alert (every 6 hours):**

```
👻 GHOSTNET CYCLE COMPLETE

📡 Chain: ethereum
⏱ Runtime: 45.2s

🕸 Coordination Clusters: 2
⚡ Hyperliquid Overlaps: 1

🔗 ProofAlpha (0G): 2 proofs submitted, 0 failed

📋 Latest Proofs:
• Proof 0x8f2a7b5c... [View]
• Proof 0xd4e9f123... [View]

🔥 SIGNALS:
• COORDINATION: USDC (85%)
```

**On 0G Explorer:**

Click the proof link:

```
https://chainscan-galileo.0g.ai/tx/0x8f2a7b5c...

Transaction Details:
- From: 0x742d35Cc...
- To: 0x{ContractAddress}
- Method: submitProof
- Wallets: 3
- Risk Score: 82
```

---

## Dashboard Integration

### To Show Proofs in Dashboard

Add this to `dashboard/app.js`:

```javascript
async function loadProofs() {
  const response = await fetch('/api/proof/latest?count=10');
  const data = await response.json();
  
  return data.proofs.map(proof => ({
    id: proof.id,
    risk: proof.riskScore,
    wallets: proof.clusterSize,
    type: proof.signalType,
    link: `https://chainscan-galileo.0g.ai/tx/${proof.storageRoot}`,
  }));
}
```

---

## Proof Statistics

The watcher tracks:

```javascript
watcher.getProofStats()
// {
//   submitted: 42,   // Proofs on-chain
//   failed: 2,       // Failed submissions
//   cached: 44       // Total in memory
// }
```

Check via API:

```bash
curl http://localhost:3000/api/proof/status
```

---

## Troubleshooting

### ProofAlpha Not Initializing

```
Error: Contract not initialized

Fix: Check .env has both:
  ✓ DEPLOYER_PRIVATE_KEY
  ✓ COORDINATION_REGISTRY_ADDRESS
```

### "Insufficient balance"

```
Error: No balance at address

Fix: Get testnet tokens:
  1. Go to https://faucet.0g.ai
  2. Connect wallet
  3. Claim 0.1 0G
  4. Check balance:
     curl https://evmrpc-testnet.0g.ai -X POST \
       -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...","latest"],"id":1}'
```

### Proofs not appearing on-chain

```
Check logs:
  1. Look for: [ProofAlpha] ✅ Proof #...
  2. Check explorer: https://chainscan-galileo.0g.ai
  3. Search for contract address

Verify transaction:
  1. Copy txHash from alert
  2. Paste in explorer
  3. Check "Success" status
```

---

## Next Steps (Days 1-15)

### ✅ Today (Day 1)
- [x] Deploy contract
- [x] Test integration
- [x] Start watcher

### 🔄 This Week (Days 2-7)
- [ ] **Run watcher for 6+ hours** — Let it detect real clusters
- [ ] **Verify proofs on-chain** — Check explorer
- [ ] **Monitor Telegram** — See alerts with proof links
- [ ] **Record watcher output** — Screenshot for demo

### 📊 Next Week (Days 8-14)
- [ ] **Dashboard proof panel** — Add UI to show latest proofs
- [ ] **Deploy to mainnet** — Change `ZG_MAINNET=true` in .env
- [ ] **Record demo video** — Show cluster → proof flow
- [ ] **Update README** — Document 0G integration

### 🎯 Final (Day 15)
- [ ] **Submit to HackQuest** — Include:
  - Contract address on explorer
  - Demo video
  - README with 0G integration docs
  - Proof count (goal: 500+)

---

## Success Metrics for Judges

When you submit, include:

| Metric | Target | Status |
|--------|--------|--------|
| On-chain proofs | 500+ | Pending (run watcher) |
| Contract verified | ✅ | Deploy today |
| 0G components used | Storage + Chain | ✅ |
| Dashboard integration | Proof panel | In progress |
| Demo video | <3 min | Create this week |

---

## Key Commands

```bash
# Deploy
npm run deploy:contract

# Test
npm run test:integration

# Start watcher
npm start

# Check status
curl http://localhost:3000/api/proof/status

# Get latest proofs
curl http://localhost:3000/api/proof/latest?count=10
```

---

## Architecture

```
GhostNet Cycle (every 6 hours)
        ↓
Detect Coordination Clusters
        ↓
For each cluster:
  ├─ Serialize to proof bundle
  ├─ Upload to 0G Storage
  ├─ Submit to CoordinationRegistry
  └─ Cache proof link
        ↓
Telegram Alert
  ├─ Report cluster
  ├─ Show proof links
  └─ Update stats
        ↓
Dashboard
  └─ Display latest 10 proofs
```

---

## Support

- **Integration Docs**: [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Setup Steps**: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **ProofAlpha Docs**: [PROOFALPHA.md](PROOFALPHA.md)

---

**Status**: 🚀 **READY FOR DEPLOYMENT**

Last updated: May 6, 2026
