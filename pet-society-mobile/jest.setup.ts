process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
process.env.EXPO_PUBLIC_REALTIME_ENABLED = "false";

jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {},
  },
  easConfig: {
    projectId: "test-project",
  },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      }),
    ),
  },
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
    }),
  ),
}));

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();

  return {
    __reset: jest.fn(() => store.clear()),
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

jest.mock("expo-notifications", () => ({
  AndroidImportance: {
    DEFAULT: "default",
    MAX: "max",
  },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted", canAskAgain: true }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted", canAskAgain: true }),
  ),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: "ExpoPushToken[test]" })),
}));

jest.mock("expo-device", () => ({
  isDevice: true,
}));
