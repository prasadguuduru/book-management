module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/dot-notation': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off'
  },
  parserOptions: {
    project: ['./tsconfig.json', './backend/tsconfig.json', './frontend/tsconfig.json'],
    tsconfigRootDir: __dirname,
  }
};
