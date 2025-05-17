import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { validateConfig } from './validators.js';
import { startServer } from './server.js';

export function runCli() {
  const program = new Command();
  program
    .name('appsync-local')
    .version('1.0.0')
    .description('Run a local AppSync server');

  program
    .command('start')
    .requiredOption('-c, --config <path>', 'config JSON path')
    .option('-p, --port <port>', 'port', process.env.PORT || '4000')
    .action(async (options) => {
      const { config, port } = options;
      const fullPath = path.resolve(process.cwd(), config);
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      } catch (e) {
        console.error(`Failed to read config: ${e.message}`);
        process.exit(1);
      }

      const cfg = validateConfig(raw);
      try {
        await startServer({ port: Number(port), ...cfg });
        console.log(`🚀 Listening on http://localhost:${port}`);
      } catch (err) {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
