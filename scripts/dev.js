#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const processes = [];
let isShuttingDown = false;

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

function startProcess(name, command, args, cwd, color) {
  log(`🚀 Starting ${name}...`, color);

  const proc = spawn(command, args, {
    cwd: cwd || process.cwd(),
    stdio: 'inherit',
    shell: true,
  });

  proc.on('error', (err) => {
    log(`❌ Error starting ${name}: ${err.message}`, colors.red);
  });

  proc.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      if (code === 0) {
        log(`✅ ${name} exited normally`, colors.green);
      } else {
        log(`💥 ${name} exited with code ${code} (signal: ${signal})`, colors.red);
      }
    }
  });

  processes.push({ name, proc, color });
  return proc;
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('\n🛑 Shutting down all services...', colors.yellow);

  // Kill all processes
  processes.forEach(({ name, proc, color }) => {
    if (proc && !proc.killed) {
      log(`🔄 Stopping ${name}...`, color);

      // On Windows, use taskkill to properly terminate process trees
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', proc.pid, '/t', '/f'], { stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');

        // Force kill after 5 seconds if not dead
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
      }
    }
  });

  // Clean up any remaining processes on common ports
  log('🧹 Cleaning up ports...', colors.cyan);

  if (process.platform === 'win32') {
    // Windows port cleanup
    const portsToClean = [3010, 4111, 55321, 55322, 55323, 55324, 55327];
    portsToClean.forEach(port => {
      spawn('powershell', [
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`
      ], { stdio: 'ignore' });
    });
  } else {
    // Unix port cleanup
    spawn('pkill', ['-f', 'next.*3010'], { stdio: 'ignore' });
    spawn('pkill', ['-f', 'mastra.*dev'], { stdio: 'ignore' });
    spawn('pkill', ['-f', 'supabase.*start'], { stdio: 'ignore' });
  }

  setTimeout(() => {
    log('👋 All services stopped. Goodbye!', colors.green);
    process.exit(0);
  }, 2000);
}

// Handle shutdown signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);

// Handle Windows Ctrl+C
if (process.platform === 'win32') {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('SIGINT', () => {
    process.emit('SIGINT');
  });
}

async function main() {
  log('🎯 Starting Calendar Mono Development Environment', colors.bright + colors.cyan);
  log('========================================', colors.cyan);

  // Start Supabase (if not already running)
  log('\n📦 Starting Supabase...', colors.blue);
  startProcess(
    'Supabase',
    'npx',
    ['supabase', 'start'],
    process.cwd(),
    colors.blue
  );

  // Wait a bit for Supabase to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Start Mastra Agent
  log('\n🤖 Starting Mastra Agent...', colors.magenta);
  startProcess(
    'Mastra Agent',
    'pnpm',
    ['dev'],
    path.join(process.cwd(), 'apps', 'agent'),
    colors.magenta
  );

  // Wait a bit for Mastra to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Calendar App
  log('\n📅 Starting Calendar App...', colors.green);
  startProcess(
    'Calendar App',
    'pnpm',
    ['dev'],
    path.join(process.cwd(), 'apps', 'calendar'),
    colors.green
  );

  // Start Supabase Functions (if any)
  log('\n⚡ Starting Supabase Functions...', colors.yellow);
  startProcess(
    'Supabase Functions',
    'npx',
    ['supabase', 'functions', 'serve', '--env-file', '.env.local'],
    process.cwd(),
    colors.yellow
  );

  log('\n🎉 All services started!', colors.bright + colors.green);
  log('========================================', colors.cyan);
  log('📅 Calendar App:      http://localhost:3010', colors.green);
  log('🤖 Mastra Agent:      http://localhost:4111', colors.magenta);
  log('📊 Supabase Studio:   http://127.0.0.1:55323', colors.blue);
  log('📧 Inbucket (Email):  http://127.0.0.1:55324', colors.blue);
  log('========================================', colors.cyan);
  log('\n💡 Press Ctrl+C to stop all services', colors.yellow);
}

main().catch((err) => {
  log(`❌ Failed to start development environment: ${err.message}`, colors.red);
  cleanup();
});