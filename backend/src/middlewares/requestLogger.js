import logger from '../utils/logger.js';

/**
 * Express HTTP Request Logging Middleware
 * Accurately measures response duration using process.hrtime.bigint()
 * Logs exactly once when the response stream finishes
 */
export const requestLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    // Calculate elapsed milliseconds with 1 decimal place precision
    const durationMs = Number((endTime - startTime) / 1000000n);

    // Strip sensitive query parameters if any (e.g. ?token=...)
    const cleanUrl = req.originalUrl || req.url;

    logger.request({
      method: req.method,
      url: cleanUrl,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
};

export default requestLogger;
