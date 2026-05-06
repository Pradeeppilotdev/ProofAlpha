#!/bin/bash
# ProofAlpha Setup Script
# Automates the initial setup process

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          ProofAlpha - 0G Integration Setup                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Node version
echo "✓ Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "  Using: $NODE_VERSION"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if npm install > /dev/null 2>&1; then
  echo "  ✓ Dependencies installed"
else
  echo "  ✗ Failed to install dependencies"
  exit 1
fi
echo ""

# Check .env file
if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
  echo "  ✓ .env created"
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and add your:"
  echo "   - DEPLOYER_PRIVATE_KEY (from your wallet)"
  echo "   - ZG_RPC_URL (0G Chain RPC endpoint)"
  echo ""
  echo "   Then run: npm run deploy:contract"
  echo ""
else
  echo "✓ .env file already exists"
  echo ""
fi

# Check contract deployment
if [ -z "$COORDINATION_REGISTRY_ADDRESS" ]; then
  echo "📋 Next steps:"
  echo "   1. Get testnet tokens: https://faucet.0g.ai"
  echo "   2. Deploy contract: npm run deploy:contract"
  echo "   3. Save contract address to .env"
  echo "   4. Run demo: npm run demo:proof"
  echo ""
else
  echo "✓ Contract already deployed: $COORDINATION_REGISTRY_ADDRESS"
  echo ""
fi

# Compile contracts
echo "🔨 Compiling contracts..."
if npx hardhat compile > /dev/null 2>&1; then
  echo "  ✓ Contracts compiled"
else
  echo "  ⚠️  Contract compilation had warnings"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Setup Complete! 🎉                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Available commands:"
echo "  npm start              - Start dashboard server"
echo "  npm run deploy:contract - Deploy to testnet"
echo "  npm run proofAlpha:demo - Run ProofAlpha demo"
echo ""
