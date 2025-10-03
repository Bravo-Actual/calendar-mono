#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warn(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// Function to check if a command exists
function commandExists(command) {
  try {
    execSync(`where ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

// Function to get Node.js version
function getNodeVersion() {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    return version.slice(1); // Remove 'v' prefix
  } catch {
    return null;
  }
}

// Function to compare versions
function compareVersions(version1, version2) {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Function to prompt user for input
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${colors.yellow}${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Function to copy environment files
function setupEnvironmentFiles() {
  const apps = ['calendar', 'calendar-ai'];

  for (const app of apps) {
    const examplePath = path.join('apps', app, '.env.example');
    const localPath = path.join('apps', app, '.env.local');

    if (fs.existsSync(examplePath)) {
      if (!fs.existsSync(localPath)) {
        fs.copyFileSync(examplePath, localPath);
        success(`Created ${localPath} from example`);
      } else {
        info(`${localPath} already exists`);
      }
    } else {
      warn(`${examplePath} not found`);
    }
  }
}

// Function to run command and capture output
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options.silent ? 'ignore' : 'inherit',
      shell: true,
      ...options
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  log('🚀 Calendar Mono Setup Script', colors.bright + colors.cyan);
  log('=================================', colors.cyan);

  // 1. Check Node.js version
  info('Checking Node.js version...');
  const nodeVersion = getNodeVersion();
  if (!nodeVersion) {
    error('Node.js is not installed');
    log('Please install Node.js >=20.9.0 from https://nodejs.org/', colors.yellow);
    process.exit(1);
  }

  if (compareVersions(nodeVersion, '20.9.0') < 0) {
    error(`Node.js ${nodeVersion} is too old (required: >=20.9.0)`);
    log('Please update Node.js from https://nodejs.org/', colors.yellow);
    process.exit(1);
  }

  success(`Node.js ${nodeVersion} ✓`);

  // 2. Check/Install PNPM
  info('Checking PNPM...');
  if (!commandExists('pnpm')) {
    warn('PNPM not found. Installing...');
    try {
      await runCommand('npm', ['install', '-g', 'pnpm@9.0.0']);
      success('PNPM installed successfully');
    } catch (err) {
      error('Failed to install PNPM');
      log('Please install PNPM manually: npm install -g pnpm', colors.yellow);
      process.exit(1);
    }
  } else {
    success('PNPM found ✓');
  }

  // 3. Check Docker
  info('Checking Docker...');
  if (!commandExists('docker')) {
    error('Docker is not installed');
    log('Please install Docker Desktop from https://docker.com/products/docker-desktop/', colors.yellow);
    process.exit(1);
  }

  try {
    execSync('docker info', { stdio: 'ignore' });
    success('Docker is running ✓');
  } catch {
    error('Docker is not running');
    log('Please start Docker Desktop', colors.yellow);
    process.exit(1);
  }

  // 4. Install dependencies
  info('Installing dependencies...');
  try {
    await runCommand('pnpm', ['install']);
    success('Dependencies installed ✓');
  } catch (err) {
    error('Failed to install dependencies');
    process.exit(1);
  }

  // 5. Setup environment files
  info('Setting up environment files...');
  setupEnvironmentFiles();

  // 6. Check for API keys
  info('Checking environment configuration...');
  const calendarAiEnv = path.join('apps', 'calendar-ai', '.env.local');

  if (fs.existsSync(calendarAiEnv)) {
    const content = fs.readFileSync(calendarAiEnv, 'utf8');
    if (content.includes('your_openrouter_api_key_here')) {
      warn('OpenRouter API key not configured in apps/calendar-ai/.env.local');
      log('You will need to add your OpenRouter API key for AI features to work', colors.yellow);
      log('Get your key at: https://openrouter.ai/keys', colors.blue);
    }
  }

  // 7. Start Supabase
  info('Starting Supabase...');
  try {
    await runCommand('npx', ['supabase', 'start']);
    success('Supabase started ✓');
  } catch (err) {
    error('Failed to start Supabase');
    log('This might be due to port conflicts or Docker issues', colors.yellow);
    process.exit(1);
  }

  // 8. Reset database with migrations
  info('Setting up database...');
  try {
    await runCommand('npx', ['supabase', 'db', 'reset', '--db-url', 'postgresql://postgres:postgres@127.0.0.1:55322/postgres']);
    success('Database setup complete ✓');
  } catch (err) {
    warn('Database reset failed - this might be expected on first run');
  }

  // 9. Final setup complete
  log('\\n🎉 Setup Complete!', colors.bright + colors.green);
  log('=================================', colors.cyan);
  log('📅 Calendar App:      http://localhost:3010', colors.green);
  log('🤖 LangGraph Agent:   http://localhost:3030', colors.magenta);
  log('📊 Supabase Studio:   http://127.0.0.1:55323', colors.blue);
  log('=================================', colors.cyan);
  log('\\nNext steps:', colors.bright);
  log('1. Configure API keys in .env.local files if needed', colors.yellow);
  log('2. Run "pnpm dev" to start all development servers', colors.green);
  log('3. Visit http://localhost:3010 to see your calendar app', colors.blue);

  const shouldStart = await promptUser('\\nStart development servers now? (y/n): ');
  if (shouldStart.toLowerCase().startsWith('y')) {
    log('\\n🚀 Starting development servers...', colors.cyan);
    await runCommand('pnpm', ['dev']);
  } else {
    log('\\n👋 Setup complete! Run "pnpm dev" when ready to start development.', colors.green);
  }
}

main().catch((err) => {
  error(`Setup failed: ${err.message}`);
  process.exit(1);
});