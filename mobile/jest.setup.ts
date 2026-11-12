// Global mocks for native modules that cannot run under Jest.

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(async () => null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
  isErrorWithCode: (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error,
  isSuccessResponse: (response: { type?: string }) => response?.type === "success",
  isCancelledResponse: (response: { type?: string }) => response?.type === "cancelled",
}));

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "es", regionCode: "AR", currencyCode: "ARS" }]),
}));

// Feature 005: binary downloads go through expo/fetch, which is the global fetch under Jest.
jest.mock("expo/fetch", () => ({
  fetch: (...args: Parameters<typeof fetch>) => global.fetch(...args),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-file-system", () => {
  const files = new Map<string, Uint8Array>();
  const folders = new Set<string>();
  const join = (...parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === "string" ? part : part.uri)).join("/");
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return folders.has(this.uri);
    }
    create() {
      folders.add(this.uri);
    }
    delete() {
      folders.delete(this.uri);
      for (const key of [...files.keys()]) if (key.startsWith(`${this.uri}/`)) files.delete(key);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    write(content: Uint8Array) {
      files.set(this.uri, content);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  return { __files: files, Directory, File, Paths: { cache: new Directory("file:///cache") } };
});
