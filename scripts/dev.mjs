import { spawn } from 'node:child_process';
const b = spawn('node', ['scripts/build.mjs', '--watch'], { stdio: 'inherit' });
setTimeout(() => {
  const s = spawn('node', ['server/index.js'], { stdio: 'inherit' });
  s.on('exit', () => b.kill());
}, 1500);
process.on('SIGINT', () => process.exit());
