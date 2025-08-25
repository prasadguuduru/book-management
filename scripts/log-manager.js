const fs = require('fs');
const path = require('path');

class ChatLogger {
    constructor() {
        this.baseDir = path.join(__dirname, '..', 'docs', 'chat-logs', 'sessions');
        this.currentSession = null;
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    startNewSession(context) {
        const date = new Date().toISOString().split('T')[0];
        const filename = `chat-session-${date}-${Math.random().toString(36).substr(2, 9)}.md`;
        this.currentSession = path.join(this.baseDir, filename);

        const template = `# Chat Session Log - ${context.title || 'Development Session'}

## Session Information
- **Date**: ${date}
- **Project**: Book Management System
- **Context**: ${context.description || 'Development Session'}

## Conversation History

`;

        fs.writeFileSync(this.currentSession, template);
        return this.currentSession;
    }

    logInteraction(interaction) {
        if (!this.currentSession) {
            this.startNewSession({ title: 'Development Session' });
        }

        const entry = `### ${new Date().toISOString()}
**User Query**: ${interaction.query}

**Assistant Response**: ${interaction.response}

**Actions Taken**:
${interaction.actions.map(action => `- ${action}`).join('\n')}

**Files Modified**:
${interaction.files.map(file => `- ${file}`).join('\n')}

---

`;

        fs.appendFileSync(this.currentSession, entry);
    }

    updateSessionSummary(summary) {
        if (!this.currentSession) return;

        const content = fs.readFileSync(this.currentSession, 'utf8');
        const updatedContent = content.replace(
            /## Session Information/,
            `## Session Information\n${summary}\n`
        );

        fs.writeFileSync(this.currentSession, updatedContent);
    }

    rotateOldLogs() {
        const files = fs.readdirSync(this.baseDir);
        const now = new Date();
        
        files.forEach(file => {
            const filePath = path.join(this.baseDir, file);
            const stats = fs.statSync(filePath);
            const days = (now - stats.mtime) / (1000 * 60 * 60 * 24);
            
            if (days > 90) { // Archive logs older than 90 days
                const archivePath = path.join(this.baseDir, 'archive', file);
                fs.mkdirSync(path.dirname(archivePath), { recursive: true });
                fs.renameSync(filePath, archivePath);
            }
        });
    }
}

module.exports = new ChatLogger();
