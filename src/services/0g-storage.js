/**
 * 0G Storage Integration
 * Handles uploading coordination proofs to 0G Storage and managing content hashes
 */

const crypto = require('crypto');

class ZeroGStorageClient {
  constructor(config = {}) {
    this.storageEndpoint = config.storageEndpoint || 'https://rpc-storage-testnet.0g.ai';
    this.chainEndpoint = config.chainEndpoint || 'https://evmrpc-testnet.0g.ai';
    this.uploadedProofs = new Map(); // In-memory cache of uploaded proofs
    this.config = config;
  }

  /**
   * Serialize a coordination cluster into a proof bundle
   * @param {Object} cluster - GhostNet cluster detection result
   * @returns {Object} Proof bundle with evidence data
   */
  serializeProofBundle(cluster) {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      detectedAt: cluster.detectedAt || Date.now(),
      signalType: cluster.signalType || 'COORDINATION_CLUSTER',
      chainSource: cluster.chainSource || 'ethereum',
      wallets: cluster.wallets || [],
      riskScore: cluster.riskScore || 0,
      convictionFactors: cluster.convictionFactors || {},
      graphMetadata: {
        clusterSize: cluster.wallets?.length || 0,
        edgeCount: cluster.edgeCount || 0,
        bfsDepth: cluster.bfsDepth || 0,
      },
      evidence: {
        transactionPatterns: cluster.transactionPatterns || [],
        timingAlignment: cluster.timingAlignment || null,
        addressLabels: cluster.addressLabels || {},
        counterpartyOverlap: cluster.counterpartyOverlap || [],
      },
    };
  }

  /**
   * Calculate SHA256 hash for proof content
   * @param {Object} proofBundle - Proof bundle object
   * @returns {string} Hex-encoded SHA256 hash
   */
  calculateStorageRoot(proofBundle) {
    const jsonString = JSON.stringify(proofBundle);
    const hash = crypto.createHash('sha256')
      .update(jsonString)
      .digest('hex');
    return '0x' + hash;
  }

  /**
   * Mock upload to 0G Storage (testnet simulation)
   * In production, this would use the 0G Storage SDK
   * @param {Object} proofBundle - Proof bundle to upload
   * @returns {Promise<{storageRoot: string, metadata: Object}>}
   */
  async uploadProofToStorage(proofBundle) {
    try {
      console.log('📤 Uploading proof bundle to 0G Storage...');

      // Calculate storage root (content hash)
      const storageRoot = this.calculateStorageRoot(proofBundle);

      // Cache the proof
      this.uploadedProofs.set(storageRoot, {
        bundle: proofBundle,
        uploadedAt: new Date().toISOString(),
        uploadedBy: this.config.submitterAddress || 'unknown',
      });

      console.log(`✅ Proof uploaded to 0G Storage`);
      console.log(`   Storage Root: ${storageRoot}`);

      return {
        success: true,
        storageRoot,
        metadata: {
          size: Buffer.byteLength(JSON.stringify(proofBundle)),
          clusterSize: proofBundle.wallets.length,
          riskScore: proofBundle.riskScore,
          uploadedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Failed to upload to 0G Storage:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retrieve a proof bundle from storage by root hash
   * @param {string} storageRoot - Content hash of the proof
   * @returns {Object|null} Proof bundle or null if not found
   */
  retrieveProof(storageRoot) {
    const proof = this.uploadedProofs.get(storageRoot);
    return proof ? proof.bundle : null;
  }

  /**
   * Get storage metadata for a proof
   * @param {string} storageRoot - Content hash
   * @returns {Object|null} Metadata or null
   */
  getProofMetadata(storageRoot) {
    const proof = this.uploadedProofs.get(storageRoot);
    return proof ? {
      bundle: proof.bundle,
      uploadedAt: proof.uploadedAt,
      uploadedBy: proof.uploadedBy,
    } : null;
  }

  /**
   * List all uploaded proofs
   * @returns {Array} Array of {storageRoot, metadata}
   */
  listUploadedProofs() {
    const proofs = [];
    for (const [storageRoot, data] of this.uploadedProofs.entries()) {
      proofs.push({
        storageRoot,
        uploadedAt: data.uploadedAt,
        walletCount: data.bundle.wallets.length,
        riskScore: data.bundle.riskScore,
      });
    }
    return proofs;
  }

  /**
   * Generate 0G Storage explorer URL for a proof
   * @param {string} storageRoot - Content hash
   * @param {boolean} mainnet - Use mainnet (default: testnet)
   * @returns {string} Explorer URL
   */
  getStorageExplorerUrl(storageRoot, mainnet = false) {
    const baseUrl = mainnet
      ? 'https://chainscan.0g.ai'
      : 'https://chainscan-galileo.0g.ai';
    return `${baseUrl}/tx/${storageRoot}`;
  }
}

module.exports = { ZeroGStorageClient };
