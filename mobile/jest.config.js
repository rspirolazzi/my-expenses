/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setupAfterEnv.ts"],
  // Paper dialog animations and slow renders time out when every core runs a suite at once.
  maxWorkers: "50%",
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/__tests__/support/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-paper|react-native-vector-icons|@react-native-google-signin/.*)",
  ],
};
