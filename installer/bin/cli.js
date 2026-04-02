#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO = 'https://github.com/robzilla1738/Memorwise.git';
const APP_NAME = 'memorwise';
const PORT = 3000;

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(msg) { console.log(msg); }
function step(msg) { log(`\n${c.cyan}→${c.reset} ${msg}`); }
function success(msg) { log(`${c.green}✓${c.reset} ${msg}`); }
function warn(msg) { log(`${c.yellow}!${c.reset} ${msg}`); }
function fail(msg) { log(`${c.red}✗${c.reset} ${msg}`); }

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function checkCommand(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
}

function openBrowser(url) {
  const platform = os.platform();
  try {
    if (platform === 'darwin') execSync(`open ${url}`, { stdio: 'ignore' });
    else if (platform === 'win32') execSync(`start ${url}`, { stdio: 'ignore' });
    else if (platform === 'linux') execSync(`xdg-open ${url}`, { stdio: 'ignore' });
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || APP_NAME;
  const fullPath = path.resolve(targetDir);

  log('');
  log(`${c.bold}  ╔══════════════════════════════════════╗${c.reset}`);
  log(`${c.bold}  ║${c.reset}         ${c.cyan}${c.bold}Memorwise${c.reset}                    ${c.bold}║${c.reset}`);
  log(`${c.bold}  ║${c.reset}  ${c.dim}Chat with your documents locally${c.reset}   ${c.bold}║${c.reset}`);
  log(`${c.bold}  ╚══════════════════════════════════════╝${c.reset}`);

  // Check Node version
  const nodeVersion = parseInt(process.version.slice(1));
  if (nodeVersion < 18) {
    fail(`Node.js 18+ required (you have ${process.version})`);
    log(`  Download: ${c.cyan}https://nodejs.org${c.reset}`);
    process.exit(1);
  }
  success(`Node.js ${process.version}`);

  // Check git
  if (!checkCommand('git')) {
    fail('git is not installed');
    log(`  Install: ${c.cyan}https://git-scm.com${c.reset}`);
    process.exit(1);
  }
  success('git available');

  // Check if directory exists
  if (fs.existsSync(fullPath)) {
    const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
    if (hasPackageJson) {
      step(`Found existing installation at ${c.bold}${targetDir}${c.reset}`);
      log(`  Starting server...`);
      process.chdir(fullPath);
      const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });
      setTimeout(() => openBrowser(`http://localhost:${PORT}`), 3000);
      child.on('exit', (code) => process.exit(code || 0));
      return;
    }
  }

  // Clone
  step(`Cloning into ${c.bold}${targetDir}${c.reset}...`);
  try {
    run(`git clone --depth 1 ${REPO} "${fullPath}"`);
  } catch {
    fail('Failed to clone repository');
    log(`  Check your internet connection and try again`);
    log(`  Or clone manually: ${c.dim}git clone ${REPO}${c.reset}`);
    process.exit(1);
  }
  success('Repository cloned');

  // Install
  process.chdir(fullPath);
  step('Installing dependencies...');
  try {
    run('npm install');
  } catch {
    fail('npm install failed');
    log(`  Try running manually: ${c.dim}cd ${targetDir} && npm install${c.reset}`);
    process.exit(1);
  }
  success('Dependencies installed');

  // Check optional tools
  log('');
  log(`${c.dim}Optional tools:${c.reset}`);
  if (checkCommand('ollama')) success('ollama (local LLM)');
  else warn(`ollama not found — install from ${c.cyan}https://ollama.com${c.reset}`);
  if (checkCommand('ffmpeg')) success('ffmpeg (video transcription)');
  else log(`  ${c.dim}○ ffmpeg — brew install ffmpeg (for video files)${c.reset}`);

  // Start
  step('Starting Memorwise...');
  log('');
  log(`  ${c.green}${c.bold}Ready!${c.reset} Opening ${c.cyan}http://localhost:${PORT}${c.reset}`);
  log('');
  log(`  ${c.dim}Go to Settings (⚙️) to configure your LLM provider${c.reset}`);
  log(`  ${c.dim}Press Ctrl+C to stop${c.reset}`);
  log('');

  setTimeout(() => openBrowser(`http://localhost:${PORT}`), 3000);

  const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code || 0));
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
