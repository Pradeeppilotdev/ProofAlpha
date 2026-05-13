/**
 * 0G Storage Integration
 * Handles uploading coordination proofs to 0G Storage and managing content hashes
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

class ZeroGStorageClient {
  constructor(config = {}) {
    this.mainnet = Boolean(config.mainnet);
    this.storageEndpoint = config.storageEndpoint || 'https://rpc-storage-testnet.0g.ai';
    this.indexerRpc = config.indexerRpc
      || (this.mainnet ? 'https://indexer-storage.0g.ai' : 'https://indexer-storage-testnet-turbo.0g.ai');
    this.chainEndpoint = config.chainEndpoint
      || config.rpcUrl
      || (this.mainnet ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
    this.privateKey = config.privateKey || null;
    this.uploadedProofs = new Map();
    this.config = config;
    this.provider = null;
    this.signer = null;
    this.indexer = null;
    this.MemData = null;
    this.isInitialized = false;
  }

  /**
   * Initialize 0G Storage SDK and signer
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      if (!this.privateKey) {
        throw new Error('DEPLOYER_PRIVATE_KEY is required for 0G Storage uploads');
      }

      const sdk = await import('@0gfoundation/0g-ts-sdk');
      const Indexer = sdk.Indexer || sdk.default?.Indexer;
      this.MemData = sdk.MemData || sdk.default?.MemData;

      if (!Indexer || !this.MemData) {
        throw new Error('Failed to load Indexer/MemData from @0gfoundation/0g-ts-sdk');
      }

      this.provider = new ethers.JsonRpcProvider(this.chainEndpoint);
      await this.provider.getBlockNumber();
      this.signer = new ethers.Wallet(this.privateKey, this.provider);
      this.indexer = new Indexer(this.indexerRpc);
      this.isInitialized = true;

      console.log(`✅ 0G Storage SDK initialized (${this.mainnet ? 'mainnet' : 'testnet'})`);
      console.log(`   Indexer: ${this.indexerRpc}`);
      console.log(`   Signer: ${this.signer.address}`);
      return true;
    } catch (error) {
      this.isInitialized = false;
      console.error('❌ Failed to initialize 0G Storage SDK:', error.message);
      return false;
    }
  }

  async ensureInitialized() {
    if (this.isInitialized && this.indexer && this.signer && this.MemData) {
      return true;
    }
    return this.initialize();
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
      proofNonce: cluster.proofNonce || `${Date.now()}:${Math.random().toString(16).slice(2)}`,
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
   * Upload proof bundle to 0G Storage using official SDK
   * @param {Object} proofBundle - Proof bundle to upload
   * @returns {Promise<{storageRoot: string, metadata: Object}>}
   */
  async uploadProofToStorage(proofBundle) {
    try {
      const ready = await this.ensureInitialized();
      if (!ready) {
        throw new Error('0G Storage client not initialized');
      }

      console.log('📤 Uploading proof bundle to 0G Storage...');

      const serialized = JSON.stringify(proofBundle, null, 2);
      const bytes = new TextEncoder().encode(serialized);
      const memData = new this.MemData(bytes);
      const [uploadResult, uploadError] = await this.indexer.upload(
        memData,
        this.chainEndpoint,
        this.signer
      );

      if (uploadError) {
        throw uploadError;
      }

      const storageRoot = uploadResult?.rootHash || this.calculateStorageRoot(proofBundle);
      const uploadTxHash = uploadResult?.txHash || null;
      const uploadedAt = new Date().toISOString();

      this.uploadedProofs.set(storageRoot, {
        bundle: proofBundle,
        uploadedAt,
        uploadedBy: this.config.submitterAddress || 'unknown',
        uploadTxHash,
      });

      console.log(`✅ Proof uploaded to 0G Storage`);
      console.log(`   Storage Root: ${storageRoot}`);
      if (uploadTxHash) {
        console.log(`   Storage TX: ${uploadTxHash}`);
      }

      return {
        success: true,
        storageRoot,
        uploadTxHash,
        metadata: {
          size: bytes.length,
          clusterSize: proofBundle.wallets.length,
          riskScore: proofBundle.riskScore,
          uploadedAt,
          indexerRpc: this.indexerRpc,
          chainEndpoint: this.chainEndpoint,
          storageTxExplorer: uploadTxHash ? this.getChainExplorerUrl(uploadTxHash) : null,
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
        uploadTxHash: proof.uploadTxHash,
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
        uploadTxHash: data.uploadTxHash || null,
      });
    }
    return proofs;
  }

  getChainExplorerUrl(txHash, mainnet = this.mainnet) {
    const baseUrl = mainnet
      ? 'https://chainscan.0g.ai'
      : 'https://chainscan-galileo.0g.ai';
    return `${baseUrl}/tx/${txHash}`;
  }

  /**
   * Generate 0G storage retrieval URL for a root hash
   * @param {string} storageRoot - Content hash
   * @param {boolean} mainnet - Use mainnet (default: testnet)
   * @returns {string} Retrieval URL
   */
  getStorageExplorerUrl(storageRoot, mainnet = this.mainnet) {
    const endpoint = this.indexerRpc
      || (mainnet ? 'https://indexer-storage.0g.ai' : 'https://indexer-storage-testnet-turbo.0g.ai');
    return `${endpoint.replace(/\/$/, '')}/file?root=${storageRoot}`;
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      mainnet: this.mainnet,
      indexerRpc: this.indexerRpc,
      chainEndpoint: this.chainEndpoint,
      signerAddress: this.signer?.address || null,
      uploadedProofs: this.uploadedProofs.size,
    };
  }
}

module.exports = { ZeroGStorageClient };
