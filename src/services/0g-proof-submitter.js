/**
 * 0G Chain Proof Submitter
 * Submits coordination proofs to the CoordinationRegistry smart contract on 0G Chain
 */

const ethers = require('ethers');

// ABI for CoordinationRegistry contract
const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'submitProof',
    inputs: [
      { name: 'storageRoot', type: 'bytes32' },
      { name: 'wallets', type: 'address[]' },
      { name: 'riskScore', type: 'uint8' },
      { name: 'signalType', type: 'string' },
      { name: 'chainSource', type: 'string' },
    ],
    outputs: [{ name: 'proofId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLatestProofs',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple[]', components: [
      { name: 'proofId', type: 'uint256' },
      { name: 'storageRoot', type: 'bytes32' },
      { name: 'wallets', type: 'address[]' },
      { name: 'riskScore', type: 'uint8' },
      { name: 'clusterSize', type: 'uint8' },
      { name: 'signalType', type: 'string' },
      { name: 'chainSource', type: 'string' },
      { name: 'detectedAt', type: 'uint256' },
      { name: 'submitter', type: 'address' },
      { name: 'flagged', type: 'bool' },
    ]}],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ProofSubmitted',
    inputs: [
      { name: 'proofId', type: 'uint256', indexed: true },
      { name: 'storageRoot', type: 'bytes32', indexed: true },
      { name: 'riskScore', type: 'uint8' },
      { name: 'signalType', type: 'string' },
      { name: 'detectedAt', type: 'uint256' },
    ],
  },
];

class ZeroGProofSubmitter {
  constructor(config = {}) {
    this.rpcUrl = config.rpcUrl || 'https://evmrpc-testnet.0g.ai';
    this.registryAddress = config.registryAddress;
    this.privateKey = config.privateKey;
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.submissionHistory = [];
    this.isTestnet = !config.mainnet;
  }

  /**
   * Initialize the connection to 0G Chain
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      console.log('🔗 Initializing 0G Chain connection...');

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      // Test connection
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`✅ Connected to 0G ${this.isTestnet ? 'Testnet' : 'Mainnet'} (block ${blockNumber})`);

      if (this.privateKey) {
        this.signer = new ethers.Wallet(this.privateKey, this.provider);
        console.log(`✅ Signer ready: ${this.signer.address}`);
      }

      if (this.registryAddress && this.signer) {
        this.contract = new ethers.Contract(
          this.registryAddress,
          REGISTRY_ABI,
          this.signer
        );
        console.log(`✅ Contract connected: ${this.registryAddress}`);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize 0G connection:', error.message);
      return false;
    }
  }

  /**
   * Submit a coordination proof to the registry
   * @param {string} storageRoot - 0G Storage content hash
   * @param {Array<string>} wallets - Wallet addresses
   * @param {number} riskScore - Risk score (0-100)
   * @param {string} signalType - Signal type label
   * @param {string} chainSource - Chain source label
   * @returns {Promise<Object>} Submission result with proofId and txHash
   */
  async submitProof(storageRoot, wallets, riskScore, signalType, chainSource) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Call initialize() first.');
      }

      console.log('📝 Submitting proof to CoordinationRegistry...');
      console.log(`   Storage Root: ${storageRoot}`);
      console.log(`   Wallets: ${wallets.length}`);
      console.log(`   Risk Score: ${riskScore}`);
      console.log(`   Signal Type: ${signalType}`);

      // Validate inputs
      if (!storageRoot.startsWith('0x')) {
        storageRoot = '0x' + storageRoot;
      }
      if (storageRoot.length !== 66) {
        throw new Error('Invalid storage root format (must be 32 bytes)');
      }

      // Validate wallets
      const validatedWallets = wallets.map(w => {
        if (!ethers.isAddress(w)) {
          throw new Error(`Invalid wallet address: ${w}`);
        }
        return ethers.getAddress(w);
      });

      // Submit transaction
      const tx = await this.contract.submitProof(
        storageRoot,
        validatedWallets,
        riskScore,
        signalType,
        chainSource
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction failed - no receipt');
      }

      console.log(`✅ Proof submitted successfully!`);
      console.log(`   Transaction Hash: ${receipt.hash}`);
      console.log(`   Block: ${receipt.blockNumber}`);

      const result = {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        walletCount: validatedWallets.length,
        riskScore,
        signalType,
        explorer: this.getExplorerUrl(receipt.hash),
      };

      this.submissionHistory.push({
        timestamp: new Date().toISOString(),
        ...result,
      });

      return result;
    } catch (error) {
      console.error('❌ Failed to submit proof:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetch latest proofs from the contract
   * @param {number} count - Number of proofs to fetch
   * @returns {Promise<Array>} Latest proofs
   */
  async getLatestProofs(count = 10) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      console.log(`📖 Fetching latest ${count} proofs...`);

      const proofs = await this.contract.getLatestProofs(count);

      return proofs.map((proof, idx) => ({
        id: proof.proofId.toString(),
        storageRoot: proof.storageRoot,
        wallets: proof.wallets,
        riskScore: Number(proof.riskScore),
        clusterSize: Number(proof.clusterSize),
        signalType: proof.signalType,
        chainSource: proof.chainSource,
        detectedAt: new Date(Number(proof.detectedAt) * 1000).toISOString(),
        submitter: proof.submitter,
        flagged: proof.flagged,
      }));
    } catch (error) {
      console.error('❌ Failed to fetch proofs:', error.message);
      return [];
    }
  }

  /**
   * Get 0G Chain explorer URL for a transaction
   * @param {string} txHash - Transaction hash
   * @returns {string} Explorer URL
   */
  getExplorerUrl(txHash) {
    const baseUrl = this.isTestnet
      ? 'https://chainscan-galileo.0g.ai'
      : 'https://chainscan.0g.ai';
    return `${baseUrl}/tx/${txHash}`;
  }

  /**
   * Get submission history
   * @returns {Array} Submission history
   */
  getSubmissionHistory() {
    return this.submissionHistory;
  }

  /**
   * Get signer address
   * @returns {string|null}
   */
  getSignerAddress() {
    return this.signer?.address || null;
  }
}

module.exports = { ZeroGProofSubmitter };
