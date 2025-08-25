# Cursor Guide for Development Best Practices

## Table of Contents
1. [Problem Statement Format](#problem-statement-format)
2. [Priority Settings](#priority-settings)
3. [Environment Configuration](#environment-configuration)
4. [Chat Recording](#chat-recording)
5. [Code Quality Standards](#code-quality-standards)
6. [Best Practices](#best-practices)

## Problem Statement Format

When creating a new feature or fixing an issue, structure your problem statement as follows:

```markdown
### Problem Statement
- **Title**: [Brief description]
- **Type**: [Feature/Bug/Enhancement/Security]
- **Priority**: [P0/P1/P2/P3]

### Technical Requirements
1. Language: [TypeScript/Python/etc.]
2. Framework: [AWS Lambda/Express/etc.]
3. Infrastructure: [Terraform/CloudFormation/etc.]

### Acceptance Criteria
1. [Criterion 1]
2. [Criterion 2]
3. [Criterion 3]

### Additional Context
- Dependencies: [List any dependencies]
- Related Issues: [Link to related issues]
- Documentation: [Link to relevant docs]
```

## Priority Settings

### 1. Technology Stack Priorities
- TypeScript/Node.js implementation
  ```typescript
  // Always use strict TypeScript configuration
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true
    }
  }
  ```

### 2. Environment Variables
Priority order:
1. Local environment (.env.local)
2. Development environment (.env.development)
3. Staging environment (.env.staging)
4. Production environment (.env.production)

```bash
# .env.local example
NODE_ENV=development
AWS_PROFILE=local
AWS_REGION=us-west-2
```

### 3. Infrastructure as Code
- Terraform modules first
- AWS CloudFormation as fallback
- Always use state files in S3 with DynamoDB locking

### 4. Security Priorities
1. Secrets management (AWS Secrets Manager)
2. IAM roles and policies
3. Network security
4. Application security

## Environment Configuration

### Local Development
```bash
# Directory structure
.
├── .env.local           # Local overrides
├── .env.development     # Development defaults
├── .env.test           # Test configuration
└── .env.production     # Production settings
```

### Environment Variables Management
1. Use dotenv for local development
2. Use AWS Parameter Store for non-sensitive configuration
3. Use AWS Secrets Manager for sensitive data

## Chat Recording

### 1. Automatic Chat Recording
- Enable chat recording in Cursor settings:
  ```json
  {
    "cursor.chat.recording": true,
    "cursor.chat.saveLocation": "./docs/chat-logs"
  }
  ```

### 2. Chat Organization
- Use descriptive titles for chat sessions
- Tag conversations with relevant labels
- Export important discussions to markdown

### 3. Chat Templates
```markdown
# Chat Session: [Title]
Date: YYYY-MM-DD
Tags: [tag1], [tag2]

## Context
[Brief description of the problem/discussion]

## Key Decisions
1. [Decision 1]
2. [Decision 2]

## Action Items
- [ ] Task 1
- [ ] Task 2

## Code Snippets
\`\`\`typescript
// Important code discussed
\`\`\`
```

## Code Quality Standards

### 1. TypeScript Standards
- Use strict mode
- Explicit return types
- Interface over Type where possible
- Proper error handling

### 2. AWS Lambda Standards
- Proper logging
- Error handling
- Performance optimization
- Cold start mitigation

### 3. Terraform Standards
- Use workspaces
- Remote state
- Module organization
- Variable validation

## Best Practices

### 1. Code Organization
```plaintext
src/
├── functions/          # Lambda functions
├── lib/               # Shared libraries
├── models/            # Data models
├── services/          # Business logic
└── utils/             # Utilities
```

### 2. Testing Strategy
- Unit tests: 80% coverage
- Integration tests: Key flows
- E2E tests: Critical paths

### 3. Documentation
- README.md in each directory
- API documentation
- Architecture diagrams
- Change logs

### 4. Git Workflow
```bash
# Branch naming
feature/[feature-name]
bugfix/[bug-name]
hotfix/[issue-name]
release/[version]
```

### 5. Code Review Checklist
- [ ] TypeScript strict checks pass
- [ ] Unit tests added/updated
- [ ] Documentation updated
- [ ] Security considerations addressed
- [ ] Performance impact considered
- [ ] Infrastructure changes reviewed

### 6. Monitoring and Logging
- Use structured logging
- Set up proper monitoring
- Configure alerts
- Regular performance reviews

## Cursor-Specific Settings

### 1. Editor Configuration
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### 2. Language-Specific Settings
```json
{
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[terraform]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "hashicorp.terraform"
  }
}
```

### 3. Snippets and Templates
- Create custom snippets for common patterns
- Use built-in templates
- Share useful snippets with team

### 4. Keyboard Shortcuts
- Learn and use Cursor-specific shortcuts
- Create custom keybindings for common operations
- Document team-specific shortcuts

## Regular Updates
- Keep Cursor updated
- Review and update settings quarterly
- Gather team feedback on tooling
- Update documentation as needed
