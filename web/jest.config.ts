import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/__tests__/support/"],
};

// These dependencies ship ESM only, so Jest has to transform them too.
const ESM_PACKAGES = [
  "country-to-currency",
  "next-intl",
  "use-intl",
  "@formatjs",
  "intl-messageformat",
  "@schummar",
];

export default async function jestConfig(): Promise<Config> {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(${ESM_PACKAGES.join("|")})/)`,
      "^.+\.module\.(css|sass|scss)$",
    ],
  };
}
