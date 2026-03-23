import 'dotenv/config';
import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log(`LINE echo bot listening on port ${config.port}`);
});

const shutdown = () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
