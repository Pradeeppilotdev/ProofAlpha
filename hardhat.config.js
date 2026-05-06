// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

if (!PRIVATE_KEY && process.env.NODE_ENV !== "test") {
  console.warn("⚠️  DEPLOYER_PRIVATE_KEY not set in .env");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // ── 0G Galileo Testnet ──────────────────────
    zero_g_testnet: {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },

    // ── 0G Mainnet ──────────────────────────────
    // Uncomment when ready for final submission
    // zero_g_mainnet: {
    //   url: "https://evmrpc.0g.ai",
    //   chainId: 16600,
    //   accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    // },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
