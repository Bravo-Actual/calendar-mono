#!/usr/bin/env node

const { spawn } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');
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

// Function to check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const proc = spawn('netstat', ['-ano'], { stdio: 'pipe' });
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const lines = output.split('\n');
        const portInUse = lines.some(line =>
          line.includes(`:${port} `) && line.includes('LISTENING')
        );
        resolve(portInUse);
      });

      proc.on('error', () => resolve(false));
    } else {
      const proc = spawn('lsof', ['-i', `:${port}`], { stdio: 'pipe' });
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      proc.on('error', () => resolve(false));
    }
  });
}

// Function to kill process on port
function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Find PID using netstat and kill it
      const proc = spawn('powershell', [
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`
      ], { stdio: 'ignore' });

      proc.on('close', () => {
        log(`🗑️  Killed process on port ${port}`, colors.yellow);
        resolve();
      });
      proc.on('error', () => resolve());
    } else {
      const proc = spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' });
      let pids = '';

      proc.stdout.on('data', (data) => {
        pids += data.toString();
      });

      proc.on('close', () => {
        const pidList = pids.trim().split('\n').filter(pid => pid);
        if (pidList.length > 0) {
          pidList.forEach(pid => {
            spawn('kill', ['-9', pid], { stdio: 'ignore' });
          });
          log(`🗑️  Killed process(es) on port ${port}`, colors.yellow);
        }
        resolve();
      });
      proc.on('error', () => resolve());
    }
  });
}

// Function to prompt user for yes/no
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${colors.yellow}${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
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

  let hasExited = false;
  proc.on('exit', (code, signal) => {
    if (!isShuttingDown && !hasExited) {
      hasExited = true;
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

  log('\n🛑 Shutting down...', colors.yellow);

  // Kill all processes silently
  processes.forEach(({ name, proc, color }) => {
    if (proc && !proc.killed) {
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

  // Clean up any remaining processes on common ports silently (just the app ports)
  if (process.platform === 'win32') {
    // Windows port cleanup - only for app ports, not Supabase
    const portsToClean = [3010];
    portsToClean.forEach(port => {
      spawn('powershell', [
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`
      ], { stdio: 'ignore' });
    });
  } else {
    // Unix port cleanup - only for app ports
    spawn('pkill', ['-f', 'next.*3010'], { stdio: 'ignore' });
    spawn('pkill', ['-f', 'mastra.*dev'], { stdio: 'ignore' });
  }

  setTimeout(() => {
    log('👋 Goodbye!', colors.green);
    process.exit(0);
  }, 1000);
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

  // Check for existing processes on development ports
  const portsToCheck = [3010, 3020];
  const busyPorts = [];

  log('🔍 Checking for existing processes...', colors.blue);

  for (const port of portsToCheck) {
    const inUse = await checkPort(port);
    if (inUse) {
      busyPorts.push(port);
    }
  }

  if (busyPorts.length > 0) {
    log(`\n⚠️  Found existing processes on ports: ${busyPorts.join(', ')}`, colors.red);
    const shouldKill = await promptUser('Kill existing processes? (y/n): ');

    if (shouldKill) {
      log('\n🗑️  Killing existing processes...', colors.yellow);
      for (const port of busyPorts) {
        await killPort(port);
      }
      // Wait a moment for processes to fully terminate
      await new Promise(resolve => setTimeout(resolve, 2000));
      log('✅ Existing processes terminated', colors.green);
    } else {
      log('❌ Cannot start development environment with existing processes', colors.red);
      log('💡 Please manually stop the processes or restart the command and choose "y"', colors.yellow);
      process.exit(1);
    }
  } else {
    log('✅ No conflicting processes found', colors.green);
  }

  // Start Supabase (if not already running)
  startProcess(
    'Supabase',
    'npx',
    ['supabase', 'start'],
    process.cwd(),
    colors.blue
  );

  // Wait a bit for Supabase to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Start Mastra Agent with graceful shutdown
  startProcess(
    'Mastra Agent',
    'node',
    ['scripts/mastra-server.js'],
    process.cwd(),
    colors.magenta
  );

  // Wait a bit for Mastra to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Calendar App
  startProcess(
    'Calendar App',
    'pnpm',
    ['dev'],
    path.join(process.cwd(), 'apps', 'calendar'),
    colors.green
  );

  // Start Supabase Functions (if any)
  startProcess(
    'Supabase Functions',
    'npx',
    ['supabase', 'functions', 'serve'],
    process.cwd(),
    colors.yellow
  );

  log('\n🎉 All services started!', colors.bright + colors.green);
  log('========================================', colors.cyan);
  log('📅 Calendar App:      http://localhost:3010', colors.green);
  log('🤖 Mastra Agent:      http://localhost:3020', colors.magenta);
  log('📊 Supabase Studio:   http://127.0.0.1:55323', colors.blue);
  log('📧 Inbucket (Email):  http://127.0.0.1:55324', colors.blue);
  log('========================================', colors.cyan);
  log('\n💡 Press Ctrl+C to stop all services', colors.yellow);
}

main().catch((err) => {
  log(`❌ Failed to start development environment: ${err.message}`, colors.red);
  cleanup();
});