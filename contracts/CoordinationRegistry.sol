// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoordinationRegistry
 * @notice ProofAlpha — Verifiable on-chain proof registry for AI-detected
 *         wallet coordination clusters. Each proof anchors a BFS graph
 *         snapshot stored on 0G Storage, making every detection auditable
 *         and tamper-evident.
 * @dev    Deployed on 0G Chain (EVM-compatible). Storage roots are
 *         content-addressed hashes from 0G Storage SDK uploads.
 */
contract CoordinationRegistry {

    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────

    struct CoordinationProof {
        uint256 proofId;          // Auto-incremented unique ID
        bytes32 storageRoot;      // 0G Storage content hash of the evidence bundle
        address[] wallets;        // Wallets identified in the cluster
        uint8    riskScore;       // 0–100 conviction score from GhostNet
        uint8    clusterSize;     // Number of wallets in the cluster
        string   signalType;      // e.g. "COORDINATED_PUMP", "WASH_TRADE", "SYBIL"
        string   chainSource;     // e.g. "hyperliquid", "0g_chain", "ethereum"
        uint256  detectedAt;      // Unix timestamp of detection
        address  submitter;       // Address that submitted this proof
        bool     flagged;         // True if cluster is high-risk (riskScore >= 75)
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    uint256 public proofCount;
    address public owner;

    // proofId => CoordinationProof
    mapping(uint256 => CoordinationProof) public proofs;

    // wallet address => array of proofIds involving that wallet
    mapping(address => uint256[]) public walletProofs;

    // storageRoot => proofId (prevent duplicate submissions)
    mapping(bytes32 => uint256) public storageRootToProof;

    // Authorised submitters (GhostNet backend wallets)
    mapping(address => bool) public authorisedSubmitters;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event ProofSubmitted(
        uint256 indexed proofId,
        bytes32 indexed storageRoot,
        uint8   riskScore,
        string  signalType,
        uint256 detectedAt
    );

    event HighRiskClusterFlagged(
        uint256 indexed proofId,
        address[] wallets,
        uint8   riskScore
    );

    event SubmitterAuthorised(address indexed submitter);
    event SubmitterRevoked(address indexed submitter);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ProofAlpha: not owner");
        _;
    }

    modifier onlyAuthorised() {
        require(
            authorisedSubmitters[msg.sender] || msg.sender == owner,
            "ProofAlpha: not authorised submitter"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorisedSubmitters[msg.sender] = true;
        emit SubmitterAuthorised(msg.sender);
    }

    // ─────────────────────────────────────────────
    //  Core: Submit a coordination proof
    // ─────────────────────────────────────────────

    /**
     * @notice Submit a new coordination proof after GhostNet detection.
     * @param  storageRoot  Content hash returned by 0G Storage SDK upload
     * @param  wallets      Array of wallet addresses in the detected cluster
     * @param  riskScore    Conviction score 0–100 from GhostNet BFS engine
     * @param  signalType   Human-readable signal label
     * @param  chainSource  Which chain/data source the wallets were detected on
     * @return proofId      The assigned proof ID
     */
    function submitProof(
        bytes32        storageRoot,
        address[] calldata wallets,
        uint8          riskScore,
        string calldata signalType,
        string calldata chainSource
    ) external onlyAuthorised returns (uint256 proofId) {
        require(storageRoot != bytes32(0),      "ProofAlpha: empty storage root");
        require(wallets.length >= 2,            "ProofAlpha: need at least 2 wallets");
        require(wallets.length <= 50,           "ProofAlpha: cluster too large");
        require(riskScore <= 100,               "ProofAlpha: invalid risk score");
        require(bytes(signalType).length > 0,   "ProofAlpha: empty signal type");
        require(
            storageRootToProof[storageRoot] == 0,
            "ProofAlpha: duplicate storage root"
        );

        proofCount++;
        proofId = proofCount;

        bool flagged = riskScore >= 75;

        proofs[proofId] = CoordinationProof({
            proofId:     proofId,
            storageRoot: storageRoot,
            wallets:     wallets,
            riskScore:   riskScore,
            clusterSize: uint8(wallets.length),
            signalType:  signalType,
            chainSource: chainSource,
            detectedAt:  block.timestamp,
            submitter:   msg.sender,
            flagged:     flagged
        });

        // Index each wallet
        for (uint256 i = 0; i < wallets.length; i++) {
            walletProofs[wallets[i]].push(proofId);
        }

        // Map storageRoot to prevent duplicates
        storageRootToProof[storageRoot] = proofId;

        emit ProofSubmitted(proofId, storageRoot, riskScore, signalType, block.timestamp);

        if (flagged) {
            emit HighRiskClusterFlagged(proofId, wallets, riskScore);
        }

        return proofId;
    }

    // ─────────────────────────────────────────────
    //  Read functions
    // ─────────────────────────────────────────────

    /**
     * @notice Get full proof details by ID.
     */
    function getProof(uint256 proofId)
        external
        view
        returns (CoordinationProof memory)
    {
        require(proofId > 0 && proofId <= proofCount, "ProofAlpha: proof not found");
        return proofs[proofId];
    }

    /**
     * @notice Get all proof IDs that involve a specific wallet.
     */
    function getWalletProofs(address wallet)
        external
        view
        returns (uint256[] memory)
    {
        return walletProofs[wallet];
    }

    /**
     * @notice Get the latest N proofs (for dashboard feed).
     * @param  count  How many recent proofs to return (max 50)
     */
    function getLatestProofs(uint256 count)
        external
        view
        returns (CoordinationProof[] memory)
    {
        if (count > 50) count = 50;
        if (count > proofCount) count = proofCount;

        CoordinationProof[] memory result = new CoordinationProof[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = proofs[proofCount - i];
        }
        return result;
    }

    /**
     * @notice Check if a wallet has ever appeared in a coordination cluster.
     */
    function isWalletFlagged(address wallet) external view returns (bool) {
        return walletProofs[wallet].length > 0;
    }

    /**
     * @notice Look up a proof by its 0G Storage root hash.
     */
    function getProofByStorageRoot(bytes32 storageRoot)
        external
        view
        returns (CoordinationProof memory)
    {
        uint256 proofId = storageRootToProof[storageRoot];
        require(proofId != 0, "ProofAlpha: storage root not found");
        return proofs[proofId];
    }

    // ─────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────

    function authoriseSubmitter(address submitter) external onlyOwner {
        authorisedSubmitters[submitter] = true;
        emit SubmitterAuthorised(submitter);
    }

    function revokeSubmitter(address submitter) external onlyOwner {
        authorisedSubmitters[submitter] = false;
        emit SubmitterRevoked(submitter);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ProofAlpha: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
