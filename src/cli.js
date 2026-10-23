#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { writeWorker } from './index.js';
const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  console.log('Usage: outage-worker <config.json>\nConfig: { "fallback": "/unavailable.html", "outDir": "public" }');
  process.exit(args[0] === '--help' ? 0 : 1);
}
try {
  const config = JSON.parse(await readFile(args[0], 'utf8'));
  if (typeof config.outDir !== 'string' || !config.outDir) throw new TypeError('outDir is required');
  console.log(await writeWorker(config));
} catch (error) {
  console.error(`outage-worker: ${error.message}`);
  process.exitCode = 1;
}
