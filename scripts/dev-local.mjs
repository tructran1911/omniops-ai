// Run `next dev` with the environment from .env.emulator (Firebase Emulator + local file storage + mocked Gemini).
// Usage: npm run dev:local  (needs npm run emulators running in another window)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

process.loadEnvFile('.env.emulator');
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
