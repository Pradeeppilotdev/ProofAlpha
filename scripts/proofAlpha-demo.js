/**
 * ProofAlpha Demo
 * Shows how to integrate 0G proofs with GhostNet cluster detections
 *
 * Usage: node scripts/proofAlpha-demo.js
 */

require('dotenv').config();
const { ProofAlphaOrchestrator } = require('../src/services/proof-alpha-orchestrator');

/**
 * Mock GhostNet cluster detection
 * In production, this comes from GhostNet.detectClusters()
 */
function mockClusterDetection() {
  return {
    detectedAt: Date.now(),
    signalType: 'COORDINATED_PUMP',
    chainSource: 'ethereum',
    wallets: [
      '0x742d35Cc6634C0532925a3b844Bc66cc1b8b3d73',
      '0x1234567890123456789012345678901234567890',
      '0x9876543210987654321098765432109876543210',
    ],
    riskScore: 82,
    convictionFactors: {
      timingAlignment: 0.9,
      addressOverlap: 0.85,
      transactionPatternSimilarity: 0.88,
      volumeCoordination: 0.92,
    },
    transactionPatterns: [
      {
        wallets: 3,
        timeWindow: '15m',
        volumeUSD: 1500000,
        pattern: 'synchronized_buys',
      },
    ],
    addressLabels: {
      '0x742d35Cc6634C0532925a3b844Bc66cc1b8b3d73': 'cex_whale_wallet',
      '0x1234567890123456789012345678901234567890': 'associated_wallet',
      '0x9876543210987654321098765432109876543210': 'associated_wallet',
    },
    counterpartyOverlap: [
      '0xdEAD000000000000000000000000000000000000',
      '0xBEEF000000000000000000000000000000000000',
    ],
    bfsDepth: 2,
    edgeCount: 8,
  };
}

/**
 * Demo function
 */
async function runDemo() {
  console.log('\n🎬 ProofAlpha 0G Integration Demo\n');

  // Initialize orchestrator with config from .env
  const orchestrator = new ProofAlphaOrchestrator({
    rpcUrl: process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
    storageEndpoint: process.env.ZG_STORAGE_ENDPOINT,
    registryAddress: process.env.COORDINATION_REGISTRY_ADDRESS,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,
    mainnet: process.env.ZG_MAINNET === 'true',
    dashboardUrl: process.env.DASHBOARD_URL,
  });

  // Initialize
  const initialized = await orchestrator.initialize();
  if (!initialized) {
    console.error('\n❌ Failed to initialize ProofAlpha');
    console.error('\nMake sure you have set in .env:');
    console.error('  - DEPLOYER_PRIVATE_KEY');
    console.error('  - COORDINATION_REGISTRY_ADDRESS');
    console.error('\nTo deploy the contract, run: npm run deploy:contract');
    process.exit(1);
  }

  // Get status
  console.log('\n📊 ProofAlpha Status:');
  const status = orchestrator.getStatus();
  console.log(JSON.stringify(status, null, 2));

  // Get latest proofs from chain
  console.log('\n📋 Fetching latest proofs from contract...');
  try {
    const latestProofs = await orchestrator.getLatestProofs(5);
    if (latestProofs.length > 0) {
      console.log(`✅ Found ${latestProofs.length} recent proofs:`);
      latestProofs.forEach((proof, i) => {
        console.log(`\n   [${i + 1}] Proof #${proof.id}`);
        console.log(`       Risk: ${proof.riskScore}/100`);
        console.log(`       Wallets: ${proof.clusterSize}`);
        console.log(`       Type: ${proof.signalType}`);
        console.log(`       Detected: ${proof.detectedAt}`);
      });
    } else {
      console.log('ℹ️  No proofs found on-chain yet');
    }
  } catch (error) {
    console.warn('⚠️  Could not fetch proofs (contract might not be deployed)');
  }

  // Demo: Process a mock cluster detection
  console.log('\n\n🔬 Demo: Processing mock cluster detection...');
  const mockCluster = mockClusterDetection();

  console.log('\n📥 Mock cluster detection:');
  console.log(JSON.stringify({
    wallets: mockCluster.wallets,
    riskScore: mockCluster.riskScore,
    signalType: mockCluster.signalType,
  }, null, 2));

  // Process the cluster
  const result = await orchestrator.processClusterDetection(mockCluster);

  if (result.success) {
    console.log('\n✅ Demo complete! Proof details:');
    console.log(JSON.stringify({
      storageRoot: result.storageRoot,
      txHash: result.proofResult.txHash,
      explorer: result.proofResult.explorer,
      dashboardLink: result.dashboardLink,
    }, null, 2));
  } else {
    console.warn('\n⚠️  Demo encountered issues:');
    console.warn(result.error || JSON.stringify(result, null, 2));
  }
}

// Run demo
runDemo().catch(error => {
  console.error('❌ Demo failed:', error.message);
  process.exit(1);
});
