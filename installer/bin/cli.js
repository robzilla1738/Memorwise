#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const VERSION = '1.0.10';
const REPO = 'https://github.com/robzilla1738/Memorwise.git';
const APP_NAME = 'memorwise';
const PORT = 4747;

// ─── Colors ──────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgBlue: '\x1b[44m',
};

function log(msg = '') { console.log(msg); }
function step(msg) { log(`\n  ${c.cyan}${c.bold}>${c.reset} ${msg}`); }
function success(msg) { log(`  ${c.green}${c.bold}✓${c.reset} ${msg}`); }
function warn(msg) { log(`  ${c.yellow}${c.bold}!${c.reset} ${c.dim}${msg}${c.reset}`); }
function fail(msg) { log(`  ${c.red}${c.bold}✗${c.reset} ${msg}`); }
function info(msg) { log(`    ${c.dim}${msg}${c.reset}`); }

const isWin = os.platform() === 'win32';

function checkCommand(cmd) {
  try { execSync(isWin ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
}

function runQuiet(cmd, cwd) {
  return execSync(cmd, { stdio: 'pipe', cwd, encoding: 'utf8' });
}

function openBrowser(url) {
  const p = os.platform();
  try {
    if (p === 'darwin') execSync(`open ${url}`, { stdio: 'ignore' });
    else if (p === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' });
    else if (p === 'linux') execSync(`xdg-open ${url}`, { stdio: 'ignore' });
  } catch {}
}

// ─── Banner ──────────────────────────────────
function banner() {
  log();
  log(`  ${c.cyan}${c.bold}  __  __                          _            ${c.reset}`);
  log(`  ${c.cyan}${c.bold} |  \\/  |___ _ __  ___ _ ___ __ _(_)___ ___   ${c.reset}`);
  log(`  ${c.cyan}${c.bold} | |\\/| / -_) '  \\/ _ \\ '_\\ V  V / (_-</ -_)  ${c.reset}`);
  log(`  ${c.cyan}${c.bold} |_|  |_\\___|_|_|_\\___/_|  \\_/\\_/|_/__/\\___|  ${c.reset}`);
  log();
  log(`  ${c.dim}Chat with your documents locally${c.reset}            ${c.dim}v${VERSION}${c.reset}`);
  log(`  ${c.dim}${'─'.repeat(49)}${c.reset}`);
}

// ─── Help ────────────────────────────────────
function showHelp() {
  banner();
  log();
  log(`  ${c.bold}Usage:${c.reset}  memorwise ${c.dim}[directory] [options]${c.reset}`);
  log();
  log(`  ${c.bold}Commands:${c.reset}`);
  log(`    ${c.cyan}memorwise${c.reset}              Install and start Memorwise`);
  log(`    ${c.cyan}memorwise my-research${c.reset}  Install into a custom directory`);
  log(`    ${c.cyan}memorwise --help${c.reset}       Show this help message`);
  log(`    ${c.cyan}memorwise --version${c.reset}    Show version number`);
  log();
  log(`  ${c.bold}Options:${c.reset}`);
  log(`    ${c.green}-h, --help${c.reset}         Show this help message`);
  log(`    ${c.green}-v, --version${c.reset}      Show version number`);
  log(`    ${c.green}-p, --port${c.reset} ${c.dim}<port>${c.reset}  Set dev server port ${c.dim}(default: 4747)${c.reset}`);
  log(`    ${c.green}--no-open${c.reset}          Don't open browser automatically`);
  log(`    ${c.green}--no-update${c.reset}        Skip checking for updates`);
  log();
  log(`  ${c.bold}What it does:${c.reset}`);
  log(`    ${c.dim}1.${c.reset} Clones the Memorwise repo (or detects existing install)`);
  log(`    ${c.dim}2.${c.reset} Checks for updates and pulls latest changes`);
  log(`    ${c.dim}3.${c.reset} Installs dependencies`);
  log(`    ${c.dim}4.${c.reset} Starts the dev server`);
  log(`    ${c.dim}5.${c.reset} Opens your browser to http://localhost:${PORT}`);
  log();
  log(`  ${c.bold}After install:${c.reset}`);
  log(`    ${c.dim}Run again with${c.reset} memorwise ${c.dim}or${c.reset} npx memorwise`);
  log(`    ${c.dim}Or manually:${c.reset}     cd memorwise && npm run dev`);
  log();
  log(`  ${c.dim}GitHub:${c.reset}  ${c.cyan}https://github.com/robzilla1738/Memorwise${c.reset}`);
  log();
}

// ─── Spinner ─────────────────────────────────
function createSpinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${frames[i]}${c.reset} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);
  return {
    stop: (msg) => {
      clearInterval(id);
      process.stdout.write(`\r  ${c.green}${c.bold}✓${c.reset} ${msg}\n`);
    },
    fail: (msg) => {
      clearInterval(id);
      process.stdout.write(`\r  ${c.red}${c.bold}✗${c.reset} ${msg}\n`);
    }
  };
}

// ─── Main ────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  if (args.includes('-v') || args.includes('--version')) {
    log(`memorwise v${VERSION}`);
    process.exit(0);
  }

  let noOpen = args.includes('--no-open');
  let port = PORT;
  const portIdx = args.indexOf('-p') !== -1 ? args.indexOf('-p') : args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1]) || PORT;
  }

  // Target directory (first arg that isn't a flag)
  const targetDir = args.find(a => !a.startsWith('-')) || APP_NAME;
  const fullPath = path.resolve(targetDir);

  banner();

  // Check Node version
  const nodeVersion = parseInt(process.version.slice(1));
  if (nodeVersion < 18) {
    log();
    fail(`Node.js 18+ required (you have ${process.version})`);
    info(`Download: https://nodejs.org`);
    process.exit(1);
  }
  success(`Node.js ${c.dim}${process.version}${c.reset}`);

  // Check git
  if (!checkCommand('git')) {
    fail('git not found');
    info(`Install: https://git-scm.com`);
    process.exit(1);
  }
  success(`git ${c.dim}available${c.reset}`);

  // Check if already installed
  let skipUpdate = args.includes('--no-update');
  if (fs.existsSync(fullPath)) {
    const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
    if (hasPackageJson) {
      log();
      step(`Existing install found at ${c.bold}${targetDir}${c.reset}`);

      // Check for updates
      if (!skipUpdate && fs.existsSync(path.join(fullPath, '.git'))) {
        const updateSpinner = createSpinner('Checking for updates...');
        try {
          runQuiet('git fetch origin', fullPath);
          const local = runQuiet('git rev-parse HEAD', fullPath).trim();
          const remote = runQuiet('git rev-parse origin/main', fullPath).trim();
          if (local !== remote) {
            updateSpinner.stop('Update available — pulling latest...');
            const pullSpinner = createSpinner('Updating Memorwise...');
            try {
              runQuiet('git pull origin main', fullPath);
              pullSpinner.stop('Updated to latest version');
              // Re-install deps if package.json changed
              const depsSpinner = createSpinner('Checking dependencies...');
              try {
                runQuiet('npm install', fullPath);
                depsSpinner.stop('Dependencies up to date');
              } catch {
                depsSpinner.fail('npm install failed — try running it manually');
              }
            } catch {
              pullSpinner.fail('Update failed — starting with current version');
            }
          } else {
            updateSpinner.stop('Already up to date');
          }
        } catch {
          updateSpinner.stop('Skipped update check');
        }
      }

      log();
      startServer(fullPath, port, noOpen);
      return;
    }
  }

  // Clone (quiet — no git noise)
  log();
  const cloneSpinner = createSpinner('Cloning repository...');
  try {
    runQuiet(`git clone --depth 1 ${REPO} "${fullPath}"`);
    cloneSpinner.stop('Repository cloned');
  } catch {
    cloneSpinner.fail('Failed to clone repository');
    info('Check your internet connection and try again');
    info(`Or clone manually: git clone ${REPO}`);
    process.exit(1);
  }

  // Install (quiet — no deprecation warnings)
  const installSpinner = createSpinner('Installing dependencies...');
  try {
    runQuiet('npm install', fullPath);
    installSpinner.stop('Dependencies installed');
  } catch {
    installSpinner.fail('npm install failed');
    info(`Try manually: cd ${targetDir} && npm install`);
    process.exit(1);
  }

  // Optional tools
  log();
  log(`  ${c.dim}Optional tools:${c.reset}`);
  if (checkCommand('ollama')) success(`ollama ${c.dim}(local LLM)${c.reset}`);
  else warn(`ollama not installed — get it at ollama.com`);
  if (checkCommand('ffmpeg')) success(`ffmpeg ${c.dim}(video transcription)${c.reset}`);
  else warn(`ffmpeg not installed — brew install ffmpeg`);

  // Start
  log();
  startServer(fullPath, port, noOpen);
}

function startServer(dir, port, noOpen) {
  const url = `http://localhost:${port}`;

  log(`  ${c.dim}${'─'.repeat(49)}${c.reset}`);
  log();
  log(`  ${c.green}${c.bold}  Ready!${c.reset}  ${c.cyan}http://localhost:${port}${c.reset}`);
  log();
  log(`  ${c.dim}  Open Settings to configure your LLM provider${c.reset}`);
  log(`  ${c.dim}  Add to Dock: ./scripts/create-desktop-app.sh${c.reset}`);
  log(`  ${c.dim}  Press Ctrl+C to stop${c.reset}`);
  log();
  log(`  ${c.dim}${'─'.repeat(49)}${c.reset}`);
  log();

  if (!noOpen) {
    const openUrl = `http://localhost:${port}`;
    setTimeout(() => openBrowser(openUrl), 2500);
  }

  process.chdir(dir);
  const env = { ...process.env };

  // Use npx next dev directly with custom port (npm run dev hardcodes --port 4747)
  const cmd = port !== PORT ? 'npx' : 'npm';
  const args = port !== PORT ? ['next', 'dev', '--port', String(port)] : ['run', 'dev'];

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: isWin,
    env,
  });
  child.on('exit', (code) => process.exit(code || 0));
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
