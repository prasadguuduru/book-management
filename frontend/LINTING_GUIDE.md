# TypeScript & ESLint Configuration Guide

## Overview
This project uses ESLint for code linting and TypeScript for type checking. The configuration is optimized for React development with TypeScript.

## Available Scripts

### Linting
- `npm run lint` - Run ESLint with warnings and errors
- `npm run lint:fix` - Auto-fix ESLint issues where possible
- `npm run lint:strict` - Run ESLint with zero warnings allowed (CI/CD)
- `npm run lint:errors-only` - Show only errors, hide warnings

### Type Checking
- `npm run type-check` - Run TypeScript compiler without emitting files
- `npm run type-check:watch` - Run type checking in watch mode

### Code Formatting
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted

### Quality Checks
- `npm run quality` - Run type checking + error-only linting (quick check)
- `npm run quality:full` - Run full quality checks including formatting

## ESLint Rules

### Current Configuration
- **React**: React-specific rules for hooks and JSX
- **TypeScript**: Basic TypeScript linting (without strict type checking)
- **Code Quality**: General JavaScript/TypeScript best practices

### Key Rules
- `no-console`: Warning (allowed in development)
- `no-unused-vars`: Warning (helps identify unused code)
- `curly`: Error (requires braces for all control statements)
- `prefer-const`: Error (use const when variable isn't reassigned)
- `react/no-unescaped-entities`: Warning (escape quotes in JSX)

## Development Workflow

### Before Committing
```bash
npm run quality:full
```

### Quick Development Check
```bash
npm run quality
```

### Auto-fix Issues
```bash
npm run lint:fix
npm run format
```

## VS Code Integration

Create `.vscode/settings.json` in your workspace:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

## Common Issues & Solutions

### 1. Unused Variables
**Issue**: `'variable' is defined but never used`
**Solution**: 
- Remove unused variables
- Prefix with `_` if intentionally unused: `const _unusedVar = value`

### 2. Console Statements
**Issue**: `Unexpected console statement`
**Solution**: 
- Remove console.log statements before production
- Use proper logging in production code

### 3. Unescaped Entities
**Issue**: `can be escaped with &quot;, &ldquo;, &#34;, &rdquo;`
**Solution**: 
- Use `&quot;` instead of `"` in JSX
- Or wrap in `{'"'}` for dynamic quotes

### 4. Missing Curly Braces
**Issue**: `Expected { after 'if' condition`
**Solution**: Always use braces for control statements:
```typescript
// Bad
if (condition) doSomething();

// Good
if (condition) {
  doSomething();
}
```

## Upgrading Configuration

To add stricter TypeScript rules:
1. Install additional packages:
   ```bash
   npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser
   ```

2. Update `.eslintrc.cjs` extends array:
   ```javascript
   extends: [
     // ... existing rules
     '@typescript-eslint/recommended',
     '@typescript-eslint/recommended-requiring-type-checking',
   ],
   ```

3. Add parser options:
   ```javascript
   parserOptions: {
     project: ['./tsconfig.json'],
     tsconfigRootDir: __dirname,
   },
   ```