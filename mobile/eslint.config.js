// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // jest.mock factories must use require() for modules referenced inside them.
    files: ["src/__tests__/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // i18next's default export is the instance; calling .use() on it is the documented API.
    files: ["src/i18n/index.ts"],
    rules: { "import/no-named-as-default-member": "off" },
  },
  {
    ignores: ["dist/*", "android/*", "ios/*", "coverage/*", "src/services/api/schema.d.ts"],
  },
]);
