// scripts/deploy.js
// Deploy CoordinationRegistry to 0G Chain (Galileo testnet or mainnet)
// Usage: npx hardhat run scripts/deploy.js --network zero_g_testnet
//   or:  npx hardhat run scripts/deploy.js --network zero_g_mainnet

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("─────────────────────────────────────────");
  console.log("  ProofAlpha — CoordinationRegistry");
  console.log("─────────────────────────────────────────");
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "0G");

  if (balance === 0n) {
    console.error("\n❌ No balance! Get testnet tokens from https://faucet.0g.ai");
    process.exit(1);
  }

  console.log("\nDeploying CoordinationRegistry...");

  const Registry = await hre.ethers.getContractFactory("CoordinationRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("\n✅ CoordinationRegistry deployed!");
  console.log("   Contract address:", address);
  console.log("   Deployer (owner):", deployer.address);
  console.log("   Network:", hre.network.name);

  const network = hre.network.name;
  if (network === "zero_g_testnet") {
    console.log("\n🔍 Testnet explorer:");
    console.log(`   https://chainscan-galileo.0g.ai/address/${address}`);
  } else if (network === "zero_g_mainnet") {
    console.log("\n🔍 Mainnet explorer:");
    console.log(`   https://chainscan.0g.ai/address/${address}`);
  }

  console.log("\n📋 Save this in your .env:");
  console.log(`   COORDINATION_REGISTRY_ADDRESS=${address}`);
  console.log("─────────────────────────────────────────\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
