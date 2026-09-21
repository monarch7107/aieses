import { createApp } from './app.js';
import { config } from './config.js';
import { providerStatus } from './services/ai/provider.js';
import { getDikshaAdapter } from './services/diksha.js';
import { executionStatus } from './services/execution/index.js';

const app = createApp();

app.listen(config.port, '0.0.0.0', () => {
  const exec = executionStatus();
  console.log(`[aieses] server listening on http://0.0.0.0:${config.port} (${config.isProd ? 'production' : 'development'})`);
  console.log(`[aieses] database: ${config.databasePath}`);
  console.log(`[aieses] AI provider: ${providerStatus().label}`);
  console.log(`[aieses] DIKSHA adapter: ${getDikshaAdapter().label}`);
  console.log(`[aieses] code execution: browser sandbox for ${exec.browserLanguages.join('/')}; server runner "${exec.serverRunner}" for ${exec.serverLanguages.join('/')}`);
  if (config.jwtSecretGenerated) console.warn('[aieses] WARNING: JWT_SECRET not set — using a random per-process secret (sessions reset on restart).');
  if (config.demoMode) console.log('[aieses] demo mode ON: one-click demo logins enabled');
});
