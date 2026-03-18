/**
 * GET /health
 * Returns service health status.
 */
export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'a2-simulator-gateway',
    timestamp: new Date().toISOString(),
  });
}
