import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { startServer } from './server.js';
import { validateConfig } from './validators/index.js';

export function runCli(): void {
  const program = new Command();
  program.name('appsync-local').version('1.0.0').description('Run a local AppSync server');

  program
    .command('start')
    .requiredOption('-c, --config <path>', 'config JSON path')
    .option('-p, --port <port>', 'port', process.env.PORT || '4000')
    .action(async (options: { config: string; port: string }) => {
      const { config, port } = options;
      const fullPath = path.resolve(process.cwd(), config);
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Failed to read config: ${errorMessage}`);
        process.exit(1);
      }

      const cfg = validateConfig(raw);
      try {
        const serverPort = Number(port);
        await startServer({ ...cfg, port: serverPort });
        console.log(`Server running at http://localhost:${serverPort}`);
      } catch (err) {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
