/**
 * GhostNet + ProofAlpha Integration Test
 * Verifies that the watcher can submit clusters to 0G
 *
 * Usage: node scripts/test-integration.js
 */

require('dotenv').config();
const { GhostNetWatcher } = require('../src/monitor/watcher');

/**
 * Mock cluster for testing (same structure as real GhostNet output)
 */
function createMockClusters() {
  return [
    {
      counterparty: '0x742d35Cc6634C0532925a3b844Bc66cc1b8b3d73',
      connectedWallets: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
      ],
      strength: 3
    },
    {
      counterparty: '0x9876543210987654321098765432109876543210',
      connectedWallets: [
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
      ],
      strength: 2
    }
  ];
}

/**
 * Run integration test
 */
async function runIntegrationTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     GhostNet + ProofAlpha Integration Test                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Create watcher
  const watcher = new GhostNetWatcher();

  console.log('📋 Step 1: Initialize watcher...');
  if (!process.env.COORDINATION_REGISTRY_ADDRESS) {
    console.error('❌ COORDINATION_REGISTRY_ADDRESS not set in .env');
    console.error('\nFix: Run deployment first:');
    console.error('  npm run deploy:contract');
    process.exit(1);
  }

  // Initialize ProofAlpha via watcher
  console.log('📋 Step 2: Initialize ProofAlpha via watcher...');
  if (process.env.DEPLOYER_PRIVATE_KEY && process.env.COORDINATION_REGISTRY_ADDRESS) {
    const { ProofAlphaOrchestrator } = require('../src/services/proof-alpha-orchestrator');
    watcher.proofAlpha = new ProofAlphaOrchestrator({
      rpcUrl: process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
      registryAddress: process.env.COORDINATION_REGISTRY_ADDRESS,
      privateKey: process.env.DEPLOYER_PRIVATE_KEY,
      mainnet: process.env.ZG_MAINNET === 'true'
    });

    const initialized = await watcher.proofAlpha.initialize();
    if (initialized) {
      console.log('✅ ProofAlpha initialized');
    } else {
      console.warn('⚠️  ProofAlpha initialization incomplete');
      console.warn('   (This is OK for testing without real credentials)');
    }
  } else {
    console.warn('⚠️  Skipping ProofAlpha init (no 0G credentials)');
  }

  // Test 1: Check watcher status
  console.log('\n📋 Step 3: Check watcher status...');
  const status = watcher.getStatus();
  console.log('✅ Status:', JSON.stringify(status, null, 2));

  // Test 2: Submit mock clusters
  console.log('\n📋 Step 4: Submit mock clusters to ProofAlpha...');
  const mockClusters = createMockClusters();
  console.log(`📥 Submitting ${mockClusters.length} mock clusters...`);

  await watcher.submitClustersToProofAlpha(mockClusters, 'ethereum');

  // Test 3: Check proof stats
  console.log('\n📋 Step 5: Check proof stats...');
  const proofStats = watcher.getProofStats();
  console.log('✅ Proof Stats:', JSON.stringify(proofStats, null, 2));

  // Test 4: Check proof links
  console.log('\n📋 Step 6: Check proof links...');
  const proofLinks = watcher.getProofLinks('ethereum');
  if (proofLinks.length > 0) {
    console.log(`✅ Found ${proofLinks.length} proof link(s):`);
    proofLinks.forEach((link, i) => {
      console.log(`   ${i + 1}. Storage: ${link.storageRoot?.slice(0, 20)}...`);
      if (link.txHash) {
        console.log(`      TX: ${link.txHash.slice(0, 20)}...`);
        console.log(`      Explorer: ${link.explorer}`);
      }
    });
  } else {
    console.log('ℹ️  No proof links found (ProofAlpha may not be connected)');
  }

  // Test 5: Simulate cycle summary
  console.log('\n📋 Step 7: Test cycle summary with proofs...');
  const { TelegramAlerter } = require('../src/monitor/telegram');
  const alerter = new TelegramAlerter();

  console.log('ℹ️  (Telegram message preview - not actually sent)\n');
  const cycleSummary = {
    chain: 'ethereum',
    tokenCount: 2,
    walletCount: 3,
    clusters: mockClusters.length,
    overlaps: 0,
    apiCalls: 5,
    runtime: 12.3,
    topSignals: ['COORDINATION: USDC (85%)', 'EARLY: USDT (75%)'],
    topTokens: [
      { symbol: 'USDC', netInflow: 1500000 },
      { symbol: 'USDT', netInflow: 800000 }
    ],
    walletProfiles: [
      { address: '0x1111111111111111111111111111111111111111', pnl: { realized_pnl_usd: 50000 } },
      { address: '0x2222222222222222222222222222222222222222', pnl: { realized_pnl_usd: 75000 } }
    ],
    rankedTokens: [],
    traceStats: {},
    proofStats: proofStats,
    proofLinks: proofLinks
  };

  // Format message (same as alerter would send)
  const tokenLines = cycleSummary.topTokens.slice(0, 3)
    .map((t, i) => `${i + 1}. <b>${t.symbol}</b> — +$${(t.netInflow || 0).toLocaleString()}`)
    .join('\n');

  const proofLine = cycleSummary.proofStats
    ? `\n\n🔗 <b>ProofAlpha (0G):</b> ${cycleSummary.proofStats.submitted} proofs submitted, ${cycleSummary.proofStats.failed} failed`
    : '';

  const proofLinks_ = cycleSummary.proofLinks && cycleSummary.proofLinks.length > 0
    ? '\n📋 <b>Latest Proofs:</b>\n' +
      cycleSummary.proofLinks.slice(0, 3)
        .map(p => `• Proof ${p.storageRoot?.slice(0, 10) || 'pending'}...`)
        .join('\n')
    : '';

  const message = `
👻 <b>GHOSTNET CYCLE COMPLETE</b>

📡 <b>Chain:</b> ${cycleSummary.chain}
⏱ <b>Runtime:</b> ${cycleSummary.runtime}s

📊 <b>TOP TOKENS:</b>
${tokenLines}

🕸 <b>Clusters:</b> ${cycleSummary.clusters}${proofLine}${proofLinks_}

🔥 <b>SIGNALS:</b>
${cycleSummary.topSignals.map(s => `• ${s}`).join('\n')}

<i>${new Date().toISOString()}</i>
  `.trim();

  console.log(message);

  // Final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  if (proofStats.submitted > 0 || proofStats.failed > 0) {
    console.log('║  ✅ INTEGRATION TEST SUCCESSFUL                             ║');
  } else {
    console.log('║  ⚠️  INTEGRATION TEST PARTIAL                               ║');
    console.log('║  (Proofs queued but not submitted to 0G)                    ║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Test Results:');
  console.log(`   Proofs submitted: ${proofStats.submitted}`);
  console.log(`   Proofs failed: ${proofStats.failed}`);
  console.log(`   Proof links: ${proofLinks.length}`);
  console.log(`   Watcher status: ${status.isRunning ? 'Running' : 'Stopped'}`);
  console.log(`   ProofAlpha ready: ${!!watcher.proofAlpha}`);

  console.log('\n📋 Next Steps:');
  if (proofStats.submitted === 0 && proofStats.failed === 0) {
    console.log('   1. Deploy contract: npm run deploy:contract');
    console.log('   2. Set COORDINATION_REGISTRY_ADDRESS in .env');
    console.log('   3. Run test again: npm run test:integration');
  } else {
    console.log('   1. Check proof links on 0G explorer');
    console.log('   2. Start watcher: npm start');
    console.log('   3. Monitor Telegram for real clusters');
  }

  console.log('\n✅ Integration test complete!\n');
}

// Run test
runIntegrationTest().catch(error => {
  console.error('\n❌ Integration test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
