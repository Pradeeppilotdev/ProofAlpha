/**
 * ProofAlpha Express Routes
 * API endpoints for proof submission and querying
 */

const express = require('express');
const { ProofAlphaOrchestrator } = require('./proof-alpha-orchestrator');

function createProofAlphaRoutes(orchestrator) {
  const router = express.Router();

  /**
   * GET /api/proof/status
   * Get ProofAlpha orchestrator status
   */
  router.get('/status', (req, res) => {
    try {
      const status = orchestrator.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/proof/latest
   * Fetch latest proofs from contract
   * Query params: count (default: 10)
   */
  router.get('/latest', async (req, res) => {
    try {
      const count = Math.min(50, parseInt(req.query.count || '10'));
      const proofs = await orchestrator.getLatestProofs(count);
      res.json({ count: proofs.length, proofs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/proof/submit
   * Submit a cluster detection as a proof
   * Body: { cluster detection object }
   */
  router.post('/submit', async (req, res) => {
    try {
      const clusterDetection = req.body;

      // Validate required fields
      if (!clusterDetection.wallets || !Array.isArray(clusterDetection.wallets)) {
        return res.status(400).json({ error: 'Missing or invalid wallets array' });
      }
      if (typeof clusterDetection.riskScore !== 'number') {
        return res.status(400).json({ error: 'Missing or invalid riskScore' });
      }

      const result = await orchestrator.processClusterDetection(clusterDetection);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/proof/:storageRoot
   * Get a cached proof by storage root
   */
  router.get('/:storageRoot', (req, res) => {
    try {
      const proof = orchestrator.getProofByRoot(req.params.storageRoot);
      if (!proof) {
        return res.status(404).json({ error: 'Proof not found' });
      }
      res.json(proof);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createProofAlphaRoutes };
