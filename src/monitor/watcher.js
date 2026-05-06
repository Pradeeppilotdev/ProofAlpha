const { GhostNet } = require('../modules/ghostnet');
const { TelegramAlerter } = require('./telegram');
const { SignalClassifier } = require('./classifier');
const { GhostNetTracer } = require('../modules/tracer');
const { FlowIntelligence } = require('../modules/flow-intel');
const { ProofAlphaOrchestrator } = require('../services/proof-alpha-orchestrator');

class GhostNetWatcher {
  constructor() {
    this.alerter = new TelegramAlerter();
    this.classifier = new SignalClassifier();
    this.proofAlpha = null; // Will be initialized in start()
    this.isRunning = false;
    this.cycleCount = 0;
    this.interval = null;
    this.chains = ['ethereum']; // ONE chain only
    this.CYCLE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    this.lastResults = {};
    this.proofStats = {
      submitted: 0,
      failed: 0,
      cached: 0
    };
  }

  async runCycle(chain) {
    console.log(`\n[Watcher] Starting cycle ${this.cycleCount + 1} on ${chain}...`);
    const start = Date.now();

    try {
      const ghostnet = new GhostNet();
      const tracer = new GhostNetTracer(ghostnet.nansen);
      const flowIntel = new FlowIntelligence(ghostnet.nansen);

      // Phase 1: Discover
      const [netflow, dexTrades] = await Promise.all([
        ghostnet.getSmartMoneyTargets(chain),
        ghostnet.getActiveSmartWallets(chain)
      ]);

      const topTokens = ghostnet.extractTopTokens(netflow);
      const walletAddresses = ghostnet.extractWallets(dexTrades, 2); // 2 wallets to save credits

      // Phase 2: Profile wallets
      const walletProfiles = [];
      for (const address of walletAddresses) {
        const [counterparties, pnl, labels] = await Promise.all([
          ghostnet.getCounterparties(address, chain),
          ghostnet.getWalletPnL(address, chain),
          ghostnet.getWalletLabels(address)
        ]);
        walletProfiles.push({
          address,
          counterparties,
          pnl: pnl?.data || pnl || {},
          labels: labels?.data?.labels || labels?.data || []
        });
      }

      // Phase 3: Deep intelligence (NEW)
      // Trace first wallet's network
      let traceResult = null;
      let rankedTokens = [];

      if (walletAddresses.length > 0) {
        traceResult = await tracer.traceWallet(walletAddresses[0], chain);
      }

      // Get flow intelligence for top tokens
      if (topTokens.length > 0) {
        rankedTokens = await flowIntel.rankTokensByConviction(topTokens, chain);
      }

      // Phase 4: Perp check
      const [perpTrades] = await Promise.all([
        ghostnet.getHyperliquidSmartMoney()
      ]);

      // Phase 5: Detect patterns
      const hyperliquidOverlap = ghostnet.detectHyperliquidOverlap(walletAddresses, perpTrades);
      const coordinationClusters = ghostnet.detectCoordination(walletProfiles);

      // Phase 5.5: Submit coordination clusters to ProofAlpha (0G)
      if (coordinationClusters.length > 0 && this.proofAlpha) {
        await this.submitClustersToProofAlpha(coordinationClusters, chain);
      }

      // Phase 6: Classify signals
      const signals = this.classifier.classify(
        topTokens, walletProfiles, coordinationClusters, hyperliquidOverlap
      );

      // Add flow-intel based signals
      for (const token of rankedTokens) {
        if (token.labelAlignment >= 2 && this.classifier.isNewSignal({
          type: 'FLOW_ALIGNMENT',
          token: token.symbol,
          chain
        })) {
          const labels = [];
          if (token.smartFlow > 0) labels.push('Smart Trader');
          if (token.whaleFlow > 0) labels.push('Whale');
          if (token.freshFlow > 10000) labels.push('Fresh Wallet');

          signals.push({
            type: token.labelAlignment >= 3 ? 'MOMENTUM' : 'EARLY',
            chain,
            token: token.symbol,
            message: `${labels.join(' + ')} all accumulating simultaneously`,
            confidence: Math.min(95, 50 + token.labelAlignment * 15),
            raw: token
          });
        }
      }

      const highConviction = signals.filter(s =>
        s.confidence >= 70 && this.classifier.isNewSignal(s)
      );

      for (const signal of highConviction) {
        console.log(`[Watcher] 🚨 Alert: ${signal.type} on ${signal.token} (${signal.confidence}%)`);
        await this.alerter.sendAlert(signal);
      }

      const runtime = ((Date.now() - start) / 1000).toFixed(1);
      const traceStats = traceResult?.data?.stats || {};

      // Send cycle summary
      await this.alerter.sendCycleSummary({
        chain,
        tokenCount: topTokens.length,
        walletCount: walletProfiles.length,
        clusters: coordinationClusters.length,
        overlaps: hyperliquidOverlap.length,
        apiCalls: ghostnet.nansen.getApiCallCount(),
        runtime,
        topSignals: highConviction.map(s => `${s.type}: ${s.token} (${s.confidence}%)`),
        topTokens,
        walletProfiles,
        rankedTokens,
        traceStats,
        proofStats: this.proofStats,
        proofLinks: this.getProofLinks(chain)
      });

      // Store results for dashboard
      this.lastResults[chain] = {
        topTokens,
        walletProfiles,
        coordinationClusters,
        hyperliquidOverlap,
        signals,
        rankedTokens,
        traceStats,
        timestamp: Date.now(),
        runtime,
        apiCalls: ghostnet.nansen.getApiCallCount()
      };

      this.cycleCount++;
      console.log(`[Watcher] Cycle complete — ${signals.length} signals, ${highConviction.length} alerts sent`);

      return this.lastResults[chain];

    } catch (error) {
      console.error(`[Watcher] Cycle error on ${chain}:`, error.message);
      return null;
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('\n👻 GhostNet Watcher starting...');

    // Initialize ProofAlpha (0G integration)
    if (process.env.COORDINATION_REGISTRY_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) {
      console.log('[Watcher] 🚀 Initializing ProofAlpha (0G)...');
      this.proofAlpha = new ProofAlphaOrchestrator({
        rpcUrl: process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
        registryAddress: process.env.COORDINATION_REGISTRY_ADDRESS,
        privateKey: process.env.DEPLOYER_PRIVATE_KEY,
        mainnet: process.env.ZG_MAINNET === 'true'
      });

      const initialized = await this.proofAlpha.initialize();
      if (initialized) {
        console.log('[Watcher] ✅ ProofAlpha ready');
      } else {
        console.warn('[Watcher] ⚠️  ProofAlpha initialization incomplete');
        this.proofAlpha = null;
      }
    } else {
      console.log('[Watcher] ℹ️  ProofAlpha disabled (no 0G config)');
    }

    await this.alerter.sendStartup(this.chains, !!this.proofAlpha);

    // Run immediately on start
    for (const chain of this.chains) {
      await this.runCycle(chain);
    }

    // Then run every 6 hours
    this.interval = setInterval(async () => {
      for (const chain of this.chains) {
        await this.runCycle(chain);
      }
    }, this.CYCLE_INTERVAL);

    console.log(`[Watcher] Running every 6 hours on ${this.chains.join(', ')}`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
    console.log('[Watcher] Stopped');
  }

  getLastResults() {
    return this.lastResults;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      cycleCount: this.cycleCount,
      chains: this.chains,
      proofStats: this.proofStats,
      proofAlphaReady: !!this.proofAlpha,
      lastResults: Object.keys(this.lastResults).map(chain => ({
        chain,
        timestamp: this.lastResults[chain]?.timestamp,
        signalCount: this.lastResults[chain]?.signals?.length || 0
      }))
    };
  }

  /**
   * Submit detected coordination clusters to ProofAlpha (0G)
   * @param {Array} clusters - Coordination clusters from GhostNet
   * @param {string} chain - Chain name
   */
  async submitClustersToProofAlpha(clusters, chain) {
    if (!this.proofAlpha) return;

    console.log(`[ProofAlpha] 📝 Submitting ${clusters.length} cluster(s) to 0G...`);

    for (const cluster of clusters) {
      try {
        // Transform GhostNet cluster to ProofAlpha proof bundle
        const clusterDetection = {
          detectedAt: Date.now(),
          signalType: 'COORDINATED_WALLETS',
          chainSource: chain,
          wallets: cluster.connectedWallets || [],
          riskScore: Math.min(100, cluster.strength * 20), // Convert strength to risk score
          convictionFactors: {
            clusterStrength: cluster.strength,
            walletOverlap: cluster.strength,
          },
          counterpartyAddress: cluster.counterparty,
          counterpartyOverlap: [cluster.counterparty],
          transactionPatterns: [],
          addressLabels: {},
          bfsDepth: 1,
          edgeCount: cluster.strength || 0,
        };

        const result = await this.proofAlpha.processClusterDetection(clusterDetection);

        if (result.success) {
          console.log(`[ProofAlpha] ✅ Proof #${cluster.counterparty.slice(0, 8)}`);
          this.proofStats.submitted++;

          // Store proof link for dashboard
          if (!this.lastResults[chain]) {
            this.lastResults[chain] = {};
          }
          if (!this.lastResults[chain].proofs) {
            this.lastResults[chain].proofs = [];
          }
          this.lastResults[chain].proofs.push({
            clusterCounterparty: cluster.counterparty,
            storageRoot: result.storageRoot,
            txHash: result.proofResult?.txHash,
            explorer: result.proofResult?.explorer,
            timestamp: Date.now(),
          });
        } else {
          console.warn(`[ProofAlpha] ⚠️  Proof submission failed: ${result.error}`);
          this.proofStats.failed++;
        }
      } catch (error) {
        console.error(`[ProofAlpha] ❌ Error submitting cluster:`, error.message);
        this.proofStats.failed++;
      }
    }
  }

  /**
   * Get proof links for dashboard
   * @param {string} chain - Chain name
   * @returns {Array} Proof links
   */
  getProofLinks(chain) {
    return this.lastResults[chain]?.proofs || [];
  }

  /**
   * Get proof stats
   * @returns {Object}
   */
  getProofStats() {
    return this.proofStats;
  }
}

module.exports = { GhostNetWatcher };
