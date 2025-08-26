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



### 21. Enhancing backend logging at each and every logic and method in backend folder especially at lambda level
**User Query**: Lets try to update verbose log across each typescript backend method, such way it is easier for developing and triaging
**Issue**: enabling logging across repo and typescript functions
**Solution**: enhance logging
**Reason**: For debugging