const logger = require('./chat-logger');
const path = require('path');

// Start a new chat session
const projectName = path.basename(process.cwd());
const context = `Project: ${projectName}\nEnvironment: Development\nDate: ${new Date().toISOString()}`;
const sessionId = logger.startNewSession(context);

console.log(`Chat logging initialized with session ID: ${sessionId}`);
console.log(`Logs will be saved in: ${path.join(process.cwd(), 'docs/chat-logs/sessions')}`);

// Clean up old sessions based on retention policy
logger.cleanupOldSessions();
