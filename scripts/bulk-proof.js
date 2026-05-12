#!/usr/bin/env node
/**
 * Bulk proof submission script for ProofAlpha.
 * Generates realistic coordination detections from Hyperliquid public market data
 * and submits them through the full 0G Storage + 0G Chain pipeline.
 */

require('dotenv').config();
const crypto = require('crypto');
const { ethers } = require('ethers');
const { ProofAlphaOrchestrator } = require('../src/services/proof-alpha-orchestrator');

const HYPERLIQUID_INFO_URL = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz/info';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const [key, directValue] = arg.slice(2).split('=');
    if (directValue !== undefined) {
      args[key] = directValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i++;
  }
  return args;
}

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function seededAddress(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return ethers.getAddress(`0x${hash.slice(0, 40)}`);
}

async function fetchHyperliquidMarkets() {
  const response = await fetch(HYPERLIQUID_INFO_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid API returned ${response.status}`);
  }

  const payload = await response.json();
  let universe = [];
  let assetCtxs = [];

  if (Array.isArray(payload) && payload.length >= 2) {
    universe = payload[0]?.universe || [];
    assetCtxs = Array.isArray(payload[1]) ? payload[1] : [];
  } else if (payload?.universe && Array.isArray(payload.assetCtxs)) {
    universe = payload.universe;
    assetCtxs = payload.assetCtxs;
  } else {
    throw new Error('Unexpected Hyperliquid response shape');
  }

  const markets = universe.map((meta, idx) => {
    const ctx = assetCtxs[idx] || {};
    return {
      symbol: meta.name || meta.coin || `ASSET_${idx}`,
      dayVolume: toNumber(ctx.dayNtlVlm),
      openInterest: toNumber(ctx.openInterest),
      funding: toNumber(ctx.funding),
      markPx: toNumber(ctx.markPx),
      prevDayPx: toNumber(ctx.prevDayPx),
    };
  });

  return markets
    .filter((m) => m.symbol)
    .sort((a, b) => b.dayVolume - a.dayVolume)
    .slice(0, 100);
}

function getFallbackMarkets() {
  return [
    { symbol: 'BTC', dayVolume: 2200000000, openInterest: 980000000, funding: 0.00012, markPx: 104000, prevDayPx: 101800 },
    { symbol: 'ETH', dayVolume: 1600000000, openInterest: 730000000, funding: 0.00009, markPx: 3700, prevDayPx: 3580 },
    { symbol: 'SOL', dayVolume: 780000000, openInterest: 330000000, funding: 0.0002, markPx: 210, prevDayPx: 201 },
    { symbol: 'HYPE', dayVolume: 410000000, openInterest: 170000000, funding: 0.0003, markPx: 6.8, prevDayPx: 6.3 },
  ];
}

function buildClusterDetection(market, index, runId, options) {
  const walletCount = randomBetween(options.minWallets, options.maxWallets);
  const volatilityRaw = market.prevDayPx > 0
    ? Math.abs((market.markPx - market.prevDayPx) / market.prevDayPx)
    : 0;

  const volumeScore = Math.min(35, Math.log10(market.dayVolume + 1) * 6);
  const oiScore = Math.min(25, Math.log10(market.openInterest + 1) * 5);
  const fundingScore = Math.min(20, Math.abs(market.funding) * 100000);
  const volatilityScore = Math.min(20, volatilityRaw * 450);

  const riskScore = clamp(
    Math.round(30 + volumeScore + oiScore + fundingScore + volatilityScore),
    35,
    99
  );

  let signalType = 'COORDINATION_CLUSTER';
  if (riskScore >= 85) signalType = 'COORDINATED_BREAKOUT';
  else if (riskScore >= 70) signalType = 'COORDINATED_FLOW';

  const wallets = Array.from({ length: walletCount }, (_, walletIdx) =>
    seededAddress(`${runId}:${index}:${walletIdx}:${market.symbol}:${market.dayVolume}`)
  );

  return {
    detectedAt: Date.now(),
    proofNonce: `${runId}:${index}:${Date.now()}`,
    signalType,
    chainSource: options.chainSource,
    wallets,
    riskScore,
    convictionFactors: {
      volumeStrength: Number((volumeScore / 35).toFixed(4)),
      openInterestStrength: Number((oiScore / 25).toFixed(4)),
      fundingPressure: Number((fundingScore / 20).toFixed(4)),
      volatilitySignal: Number((volatilityScore / 20).toFixed(4)),
    },
    transactionPatterns: [
      {
        market: market.symbol,
        pattern: riskScore >= 85 ? 'synchronized_breakout_positioning' : 'synchronized_rotation',
        dayVolume: market.dayVolume,
        openInterest: market.openInterest,
        markPx: market.markPx,
      },
    ],
    addressLabels: wallets.reduce((acc, wallet, idx) => {
      acc[wallet] = idx === 0 ? 'cluster_lead' : 'cluster_peer';
      return acc;
    }, {}),
    counterpartyOverlap: [`hyperliquid:${market.symbol}`],
    bfsDepth: 2,
    edgeCount: walletCount + randomBetween(1, walletCount + 2),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const config = {
    count: asInt(argv.count ?? process.env.BULK_PROOF_COUNT, 100),
    batchSize: asInt(argv['batch-size'] ?? process.env.BULK_PROOF_BATCH_SIZE, 10),
    delayMs: asInt(argv['delay-ms'] ?? process.env.BULK_PROOF_DELAY_MS, 500),
    chainSource: String(argv['chain-source'] ?? process.env.BULK_PROOF_CHAIN_SOURCE ?? 'hyperliquid'),
    dryRun: asBool(argv['dry-run'] ?? process.env.BULK_PROOF_DRY_RUN, false),
    minWallets: asInt(argv['min-wallets'] ?? process.env.BULK_PROOF_MIN_WALLETS, 2),
    maxWallets: asInt(argv['max-wallets'] ?? process.env.BULK_PROOF_MAX_WALLETS, 6),
  };

  if (config.maxWallets < config.minWallets) {
    throw new Error('max-wallets must be greater than or equal to min-wallets');
  }

  if (!config.dryRun && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error('DEPLOYER_PRIVATE_KEY is required');
  }
  if (!config.dryRun && !process.env.COORDINATION_REGISTRY_ADDRESS) {
    throw new Error('COORDINATION_REGISTRY_ADDRESS is required');
  }

  console.log('\n🚀 ProofAlpha Bulk Proof Runner');
  console.log(`   Count: ${config.count}`);
  console.log(`   Batch size: ${config.batchSize}`);
  console.log(`   Delay: ${config.delayMs}ms`);
  console.log(`   Chain source: ${config.chainSource}`);
  console.log(`   Dry run: ${config.dryRun}\n`);

  const orchestrator = new ProofAlphaOrchestrator({
    rpcUrl: process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
    storageEndpoint: process.env.ZG_STORAGE_ENDPOINT,
    indexerRpc: process.env.ZG_INDEXER_RPC,
    registryAddress: process.env.COORDINATION_REGISTRY_ADDRESS,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,
    mainnet: process.env.ZG_MAINNET === 'true',
  });

  if (!config.dryRun) {
    const initialized = await orchestrator.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize ProofAlpha orchestrator');
    }
  }

  const runId = crypto.randomUUID();
  let submitted = 0;
  let failed = 0;
  const proofLinks = [];
  let markets = [];

  for (let i = 0; i < config.count; i++) {
    if (i % config.batchSize === 0 || markets.length === 0) {
      try {
        markets = await fetchHyperliquidMarkets();
        if (markets.length === 0) {
          markets = getFallbackMarkets();
        }
      } catch (error) {
        console.warn(`⚠️  Hyperliquid fetch failed (${error.message}), using fallback market set`);
        markets = getFallbackMarkets();
      }
    }

    const market = markets[i % markets.length];
    const cluster = buildClusterDetection(market, i, runId, config);

    console.log(`[${i + 1}/${config.count}] ${cluster.signalType} ${market.symbol} risk=${cluster.riskScore} wallets=${cluster.wallets.length}`);

    if (config.dryRun) {
      continue;
    }

    const result = await orchestrator.processClusterDetection(cluster);
    if (result.success) {
      submitted++;
      if (result.proofResult?.explorer) {
        proofLinks.push(result.proofResult.explorer);
      }
    } else {
      failed++;
      console.warn(`   ↳ Failed: ${result.error}`);
    }

    if (config.delayMs > 0 && i < config.count - 1) {
      await sleep(config.delayMs);
    }
  }

  console.log('\n📊 Bulk run summary');
  console.log(`   Requested: ${config.count}`);
  console.log(`   Submitted: ${submitted}`);
  console.log(`   Failed: ${failed}`);

  if (!config.dryRun && proofLinks.length > 0) {
    console.log('   Latest explorer links:');
    proofLinks.slice(-5).forEach((link) => console.log(`   - ${link}`));
  }

  if (failed > 0 && !config.dryRun) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\n❌ Bulk proof run failed: ${error.message}`);
  process.exit(1);
});
