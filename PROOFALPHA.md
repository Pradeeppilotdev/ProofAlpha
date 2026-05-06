# ProofAlpha: 0G Integration for GhostNet

**ProofAlpha** is the production integration layer that connects GhostNet's coordination detection engine to 0G's decentralized infrastructure. It automatically:

1. **Serializes** cluster detections into proof bundles
2. **Uploads** proofs to 0G Storage (persistent, verifiable)
3. **Anchors** proofs on-chain via the CoordinationRegistry contract
4. **Exposes** proofs via dashboard API

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ GhostNet (BFS Coordination Detection)               │
└──────────────────────┬──────────────────────────────┘
                       │ Cluster Detection
                       ▼
┌─────────────────────────────────────────────────────┐
│ ProofAlpha Orchestrator                             │
│  ├─ Serialize Proof Bundle                          │
│  ├─ Upload to 0G Storage                            │
│  └─ Submit to CoordinationRegistry                  │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
    ┌────────────────┐    ┌──────────────────┐
    │ 0G Storage     │    │ 0G Chain         │
    │ (Evidence)     │    │ (Proof Events)   │
    └────────────────┘    └──────────────────┘
           │                      │
           └──────────┬───────────┘
                      ▼
             Dashboard API
        (Proof Status Panel)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get 0G Testnet Tokens

Visit https://faucet.0g.ai and claim tokens for your wallet.

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your private key and endpoints:

```env
DEPLOYER_PRIVATE_KEY=0x...
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
COORDINATION_REGISTRY_ADDRESS=  # Will be filled after deployment
```

### 4. Deploy Contract

```bash
npm run deploy:contract
```

Save the contract address to `.env`:

```env
COORDINATION_REGISTRY_ADDRESS=0x...
```

### 5. Run the Demo

```bash
node scripts/proofAlpha-demo.js
```

This will:
- Initialize the orchestrator
- Process a mock cluster detection
- Upload proof to 0G Storage
- Submit proof to 0G Chain
- Display proof links

## Integration with Existing Code

### Integrating with GhostNet Watcher

In `src/monitor/watcher.js` or wherever you detect clusters:

```javascript
const { ProofAlphaOrchestrator } = require('../services/proof-alpha-orchestrator');

// Initialize once on startup
const proofAlpha = new ProofAlphaOrchestrator({
  rpcUrl: process.env.ZG_RPC_URL,
  registryAddress: process.env.COORDINATION_REGISTRY_ADDRESS,
  privateKey: process.env.DEPLOYER_PRIVATE_KEY,
});

await proofAlpha.initialize();

// When you detect a cluster:
async function onClusterDetected(cluster) {
  const result = await proofAlpha.processClusterDetection(cluster);
  
  if (result.success) {
    console.log('✅ Proof submitted:', result.storageRoot);
    // Update dashboard with proof link
  }
}
```

### API Endpoints

Once integrated with Express server:

```bash
# Check orchestrator status
GET /api/proof/status

# Get latest proofs
GET /api/proof/latest?count=10

# Submit a cluster as a proof
POST /api/proof/submit
Body: {
  wallets: [...],
  riskScore: 82,
  signalType: "COORDINATED_PUMP",
  chainSource: "ethereum"
}

# Get cached proof by storage root
GET /api/proof/:storageRoot
```

## File Structure

```
├── contracts/
│   └── CoordinationRegistry.sol          # Smart contract on 0G Chain
├── scripts/
│   ├── deploy.js                         # Contract deployment
│   └── proofAlpha-demo.js                # Demo script
├── src/services/
│   ├── 0g-storage.js                     # 0G Storage client
│   ├── 0g-proof-submitter.js             # Contract submission
│   ├── proof-alpha-orchestrator.js       # Main orchestrator
│   └── proof-alpha-routes.js             # Express routes
├── hardhat.config.js                     # Hardhat configuration
└── .env.example                          # Environment template
```

## Key Classes

### `ProofAlphaOrchestrator`

Main orchestrator that coordinates the entire flow:

```javascript
const orchestrator = new ProofAlphaOrchestrator(config);
await orchestrator.initialize();

const result = await orchestrator.processClusterDetection(clusterDetection);
// Returns: { success, storageRoot, storageResult, proofResult, ... }
```

### `ZeroGStorageClient`

Handles serialization and uploads to 0G Storage:

```javascript
const storageClient = new ZeroGStorageClient();
const bundle = storageClient.serializeProofBundle(cluster);
const result = await storageClient.uploadProofToStorage(bundle);
// Returns: { success, storageRoot, metadata }
```

### `ZeroGProofSubmitter`

Submits proofs to the smart contract:

```javascript
const submitter = new ZeroGProofSubmitter(config);
await submitter.initialize();

const result = await submitter.submitProof(
  storageRoot,
  wallets,
  riskScore,
  signalType,
  chainSource
);
// Returns: { success, txHash, blockNumber, explorer }
```

## Proof Bundle Format

Each cluster is serialized as:

```json
{
  "version": "1.0",
  "timestamp": "2026-05-05T...",
  "detectedAt": 1715000000,
  "signalType": "COORDINATION_CLUSTER",
  "chainSource": "ethereum",
  "wallets": ["0x742d...", "0x1234...", "0x9876..."],
  "riskScore": 82,
  "convictionFactors": {
    "timingAlignment": 0.9,
    "addressOverlap": 0.85,
    "transactionPatternSimilarity": 0.88,
    "volumeCoordination": 0.92
  },
  "graphMetadata": {
    "clusterSize": 3,
    "edgeCount": 8,
    "bfsDepth": 2
  },
  "evidence": {
    "transactionPatterns": [...],
    "timingAlignment": {...},
    "addressLabels": {...},
    "counterpartyOverlap": [...]
  }
}
```

## Dashboard Integration

### Proof Status Card

Show proof details in the dashboard:

```javascript
// Fetch proofs
const proofs = await fetch('/api/proof/latest?count=10').then(r => r.json());

// Display in card
proofs.forEach(proof => {
  console.log(`
    🔍 Proof #${proof.id}
    📊 Risk: ${proof.riskScore}/100
    👥 Wallets: ${proof.clusterSize}
    🔗 Storage: ${proof.storageRoot}
    ✓ On-chain: ${proof.txHash}
  `);
});
```

### Proof Link Components

Create clickable links to proofs:

```javascript
// Storage explorer
https://chainscan-galileo.0g.ai/tx/{storageRoot}

// On-chain proof
https://chainscan-galileo.0g.ai/tx/{txHash}

// Dashboard proof panel
http://localhost:3000/proof?storageRoot={storageRoot}&txHash={txHash}
```

## Testing

### Run Demo

```bash
node scripts/proofAlpha-demo.js
```

### Manual Contract Testing

```javascript
// Connect to testnet
const hre = require('hardhat');

// Check latest proofs
const registry = await hre.ethers.getContractAt(
  'CoordinationRegistry',
  process.env.COORDINATION_REGISTRY_ADDRESS
);

const proofs = await registry.getLatestProofs(10);
console.log(proofs);
```

## Troubleshooting

### "Contract not initialized"

```
Fix: Set COORDINATION_REGISTRY_ADDRESS and DEPLOYER_PRIVATE_KEY in .env
```

### "No balance"

```
Fix: Get testnet tokens from https://faucet.0g.ai
```

### "Transaction failed - no receipt"

```
Fix: Check RPC endpoint is working:
  curl https://evmrpc-testnet.0g.ai -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### "Invalid wallet address"

```
Fix: Ensure all wallet addresses are valid checksummed Ethereum addresses
```

## Next Steps

1. **Integrate with GhostNet Watcher** — Auto-submit clusters as they're detected
2. **Add Dashboard Panel** — Show proof status in the UI
3. **Deploy to Mainnet** — Change `ZG_MAINNET=true` in `.env`
4. **Community Voting** — Track Community Award votes on Discord/X
5. **Submit to Hackathon** — Include contract address and demo video

## Support

For issues or questions:
1. Check the demo: `node scripts/proofAlpha-demo.js`
2. Review environment setup: `cat .env`
3. Verify contract deployment: Check explorer at `https://chainscan-galileo.0g.ai`

---

**ProofAlpha Status**: ✅ Ready for integration
