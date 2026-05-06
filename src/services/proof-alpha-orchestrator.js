/**
 * ProofAlpha Orchestrator
 * Coordinates 0G Storage uploads and contract proof submissions
 * Integrates with GhostNet coordination detection pipeline
 */

const { ZeroGStorageClient } = require('./0g-storage');
const { ZeroGProofSubmitter } = require('./0g-proof-submitter');

class ProofAlphaOrchestrator {
  constructor(config = {}) {
    this.storageClient = new ZeroGStorageClient({
      storageEndpoint: config.storageEndpoint,
      chainEndpoint: config.chainEndpoint,
      submitterAddress: config.submitterAddress,
    });

    this.proofSubmitter = new ZeroGProofSubmitter({
      rpcUrl: config.rpcUrl || 'https://evmrpc-testnet.0g.ai',
      registryAddress: config.registryAddress,
      privateKey: config.privateKey,
      mainnet: config.mainnet,
    });

    this.config = config;
    this.proofCache = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the orchestrator
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      console.log('🚀 ProofAlpha Orchestrator initializing...\n');

      const proofSubmitterReady = await this.proofSubmitter.initialize();

      if (!proofSubmitterReady) {
        console.warn('⚠️  Proof submitter initialization incomplete');
        console.warn('   (Make sure DEPLOYER_PRIVATE_KEY and COORDINATION_REGISTRY_ADDRESS are set)');
      }

      this.isInitialized = true;
      console.log('✅ ProofAlpha ready\n');

      return true;
    } catch (error) {
      console.error('❌ Orchestrator initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Process a GhostNet cluster detection and submit as a proof
   * @param {Object} clusterDetection - GhostNet cluster result
   * @returns {Promise<Object>} Processing result
   */
  async processClusterDetection(clusterDetection) {
    try {
      if (!this.isInitialized) {
        throw new Error('Orchestrator not initialized');
      }

      console.log('\n═══════════════════════════════════════');
      console.log('🔍 Processing cluster detection...');
      console.log('═══════════════════════════════════════\n');

      // Step 1: Serialize the cluster into a proof bundle
      console.log('📦 Step 1: Serializing proof bundle...');
      const proofBundle = this.storageClient.serializeProofBundle(clusterDetection);
      console.log(`   ✓ Bundle created (${proofBundle.wallets.length} wallets)`);

      // Step 2: Upload to 0G Storage
      console.log('\n💾 Step 2: Uploading to 0G Storage...');
      const storageResult = await this.storageClient.uploadProofToStorage(proofBundle);

      if (!storageResult.success) {
        throw new Error(`Storage upload failed: ${storageResult.error}`);
      }

      const { storageRoot } = storageResult;
      console.log(`   ✓ Storage root: ${storageRoot}`);

      // Step 3: Submit proof to contract
      console.log('\n📝 Step 3: Submitting proof to contract...');

      const wallets = clusterDetection.wallets || [];
      const riskScore = Math.min(100, clusterDetection.riskScore || 0);
      const signalType = clusterDetection.signalType || 'COORDINATION_CLUSTER';
      const chainSource = clusterDetection.chainSource || 'ethereum';

      const proofResult = await this.proofSubmitter.submitProof(
        storageRoot,
        wallets,
        riskScore,
        signalType,
        chainSource
      );

      if (!proofResult.success) {
        console.warn('⚠️  Proof submission to contract failed');
        console.warn(`   Error: ${proofResult.error}`);
        console.warn('   (Proof still stored on 0G Storage)');
      } else {
        console.log(`   ✓ Proof ID: ${proofResult.proofId || 'pending'}`);
        console.log(`   ✓ Transaction: ${proofResult.txHash}`);
        console.log(`   ✓ Explorer: ${proofResult.explorer}`);
      }

      // Cache result
      const fullResult = {
        success: storageResult.success && proofResult.success,
        storageRoot,
        storageResult,
        proofResult,
        timestamp: new Date().toISOString(),
        dashboardLink: this.generateDashboardLink(storageRoot, proofResult),
      };

      this.proofCache.set(storageRoot, fullResult);

      console.log('\n═══════════════════════════════════════');
      console.log(`${fullResult.success ? '✅ SUCCESS' : '⚠️  PARTIAL'} Proof processed!`);
      console.log('═══════════════════════════════════════\n');

      return fullResult;
    } catch (error) {
      console.error('\n❌ Processing failed:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate a dashboard link for the proof
   * @param {string} storageRoot - 0G Storage root hash
   * @param {Object} proofResult - Proof submission result
   * @returns {string} Dashboard URL
   */
  generateDashboardLink(storageRoot, proofResult) {
    const baseUrl = this.config.dashboardUrl || 'http://localhost:3000';
    const params = new URLSearchParams({
      storageRoot,
      txHash: proofResult.txHash || '',
    });
    return `${baseUrl}/proof?${params.toString()}`;
  }

  /**
   * Fetch latest proofs from the contract
   * @param {number} count - Number of proofs
   * @returns {Promise<Array>}
   */
  async getLatestProofs(count = 10) {
    try {
      return await this.proofSubmitter.getLatestProofs(count);
    } catch (error) {
      console.error('Failed to fetch proofs:', error.message);
      return [];
    }
  }

  /**
   * Retrieve a cached proof
   * @param {string} storageRoot - 0G Storage root hash
   * @returns {Object|null}
   */
  getProofByRoot(storageRoot) {
    return this.proofCache.get(storageRoot) || null;
  }

  /**
   * Get status information
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      signerAddress: this.proofSubmitter.getSignerAddress(),
      registryAddress: this.config.registryAddress,
      proofsCached: this.proofCache.size,
      submissionHistory: this.proofSubmitter.getSubmissionHistory(),
      network: this.proofSubmitter.isTestnet ? 'Testnet' : 'Mainnet',
    };
  }
}

module.exports = { ProofAlphaOrchestrator };
