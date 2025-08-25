const fs = require('fs');
const path = require('path');
const moment = require('moment');

class ChatLogger {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    this.template = fs.readFileSync(path.join(__dirname, 'template.md'), 'utf8');
    this.currentSession = null;
    this.sessionFile = null;
  }

  startNewSession(context = '') {
    const date = moment().format('YYYY-MM-DD');
    const sessionId = `${date}-${Math.random().toString(36).substr(2, 9)}`;
    const fileName = `chat-session-${sessionId}.md`;
    this.sessionFile = path.join(this.config.logging.directory, fileName);

    const sessionContent = this.template
      .replace('{date}', date)
      .replace('{session_id}', sessionId)
      .replace('{project_name}', path.basename(process.cwd()))
      .replace('{context}', context);

    fs.writeFileSync(this.sessionFile, sessionContent);
    this.currentSession = sessionId;
    return sessionId;
  }

  logInteraction(userQuery, assistantResponse, actions = [], filesModified = []) {
    if (!this.sessionFile) {
      this.startNewSession();
    }

    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logEntry = `
### ${timestamp}
**User Query**:
\`\`\`
${userQuery}
\`\`\`

**Assistant Response**:
\`\`\`
${assistantResponse}
\`\`\`

**Actions Taken**:
${actions.map(action => `- ${action}`).join('\n')}

**Files Modified**:
${filesModified.map(file => `- ${file}`).join('\n')}

---
`;

    fs.appendFileSync(this.sessionFile, logEntry);
  }

  updateSummary(interactionCount, filesModifiedCount, keyDecisions = [], tags = []) {
    if (!this.sessionFile) return;

    const content = fs.readFileSync(this.sessionFile, 'utf8');
    const updatedContent = content
      .replace('{interaction_count}', interactionCount)
      .replace('{files_modified_count}', filesModifiedCount)
      .replace('{key_decisions}', keyDecisions.join(', '))
      .replace('{tags}', tags.map(tag => `#${tag}`).join(' '));

    fs.writeFileSync(this.sessionFile, updatedContent);
  }

  endSession() {
    if (!this.sessionFile) return;

    // Clean up any remaining template placeholders
    const content = fs.readFileSync(this.sessionFile, 'utf8');
    const cleanedContent = content
      .replace(/{[^}]+}/g, '')
      .replace(/\n\n+/g, '\n\n');

    fs.writeFileSync(this.sessionFile, cleanedContent);
    this.currentSession = null;
    this.sessionFile = null;
  }

  cleanupOldSessions() {
    const { days, maxFiles } = this.config.logging.retention;
    const directory = this.config.logging.directory;
    const files = fs.readdirSync(directory)
      .filter(file => file.startsWith('chat-session-'))
      .map(file => ({
        name: file,
        path: path.join(directory, file),
        time: fs.statSync(path.join(directory, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    // Remove files older than retention days
    const cutoffTime = moment().subtract(days, 'days').valueOf();
    files.forEach(file => {
      if (file.time < cutoffTime) {
        fs.unlinkSync(file.path);
      }
    });

    // Keep only maxFiles number of files
    if (files.length > maxFiles) {
      files.slice(maxFiles).forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
  }
}

module.exports = new ChatLogger();
