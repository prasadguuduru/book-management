[Previous content remains...]

### 21. TypeScript Error.cause Support
**User Query**: Why ESLint not ignoring?
**Issue**: The error is from TypeScript compiler, not ESLint
**Solution**: Updated backend tsconfig.json to use ES2022
**Change**:
```diff
- "target": "ES2020"
+ "target": "ES2022"
+ "lib": ["ES2022"]
```
**Reason**: Error.cause property requires ES2022 or later