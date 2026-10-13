// Universal Pest Control — Root Server Entrypoint
require('dotenv').config();

const http = require('http');
const app = require('./server/app');
const { checkConnection, dbConfig } = require('./server/config/database');
const logger = require('./server/utils/logger');

const { validateJwtSecret } = require('./server/utils/jwt');

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  // Validate Security Credentials (fails startup in production if JWT_SECRET is missing or insecure)
  validateJwtSecret(process.env.NODE_ENV, process.env.JWT_SECRET);

  // Test Database Connection (non-blocking so server can start while waiting for DB credentials)
  checkConnection().catch((err) => {
    logger.warn(`Initial database check failed: ${err.message}`);
  });

  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`Universal Pest Control enterprise server running at: http://localhost:${PORT}`);
    logger.info(`API Endpoints mounted at: http://localhost:${PORT}/api`);
    logger.info(`Admin Portal available at: http://localhost:${PORT}/admin.html`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    logger.info('Shutting down HTTP server gracefully...');
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logger.error('Failed to start application server:', err);
  process.exit(1);
});
