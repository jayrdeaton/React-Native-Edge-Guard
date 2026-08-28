const { defineConfig } = require('eslint/config')
const base = require('@infinitetoken/eslint-config/react-native')

module.exports = defineConfig([
  ...base,
  {
    // plugin/ and app.plugin.js run under plain Node at `expo prebuild` time, not React Native at
    // runtime — a different execution context than everything the react-native preset assumes.
    ignores: ['.yalc/**', '**/*.cjs', 'src/__mocks__/**', 'src/__tests__/**', 'plugin/**', 'app.plugin.js', '.claude/worktrees/**']
  }
])
