#!/usr/bin/env node

// We need to use the Mastra CLI to handle TypeScript compilation
// This script will spawn the mastra dev process with graceful shutdown
const { spawn } = require('child_process');
const path = require('path');

let mastraProcess = null;
let isShuttingDown = false;

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

const gracefulShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('\n🛑 Mastra Agent: Initiating graceful shutdown...', colors.yellow);

  try {
    if (mastraProcess && !mastraProcess.killed) {
      log('🌐 Stopping Mastra process...', colors.cyan);

      // Send SIGTERM first for graceful shutdown
      mastraProcess.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Force kill if still running
      if (!mastraProcess.killed) {
        log('🔄 Force stopping Mastra process...', colors.yellow);

        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', mastraProcess.pid, '/t', '/f'], { stdio: 'ignore' });
        } else {
          mastraProcess.kill('SIGKILL');
        }
      }

      log('✅ Mastra process stopped', colors.green);
    }

    log('👋 Mastra Agent shutdown complete', colors.green);
  } catch (error) {
    log(`❌ Error during shutdown: ${error.message}`, colors.red);
  } finally {
    process.exit(0);
  }
};

// Register signal handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`💥 Uncaught exception: ${error.message}`, colors.red);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  log(`💥 Unhandled rejection: ${reason}`, colors.red);
  gracefulShutdown();
});

// Start the server
async function start() {
  try {
    log('🤖 Starting Mastra Agent with graceful shutdown...', colors.magenta);

    const agentDir = path.join(process.cwd(), 'apps', 'agent');

    mastraProcess = spawn('pnpm', ['run', 'dev'], {
      cwd: agentDir,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env }
    });

    mastraProcess.on('error', (err) => {
      log(`❌ Error starting Mastra: ${err.message}`, colors.red);
      process.exit(1);
    });

    mastraProcess.on('exit', (code, signal) => {
      if (!isShuttingDown) {
        if (code === 0) {
          log('✅ Mastra Agent exited normally', colors.green);
        } else {
          log(`💥 Mastra Agent exited with code ${code} (signal: ${signal})`, colors.red);
        }
        process.exit(code || 0);
      }
    });

    log('✅ Mastra Agent started successfully', colors.green);
  } catch (error) {
    log(`❌ Failed to start Mastra Agent: ${error.message}`, colors.red);
    process.exit(1);
  }
}

start().catch((error) => {
  log(`💥 Startup error: ${error.message}`, colors.red);
  process.exit(1);
});