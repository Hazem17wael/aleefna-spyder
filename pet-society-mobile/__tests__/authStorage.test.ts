import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import {
  AUTH_TOKEN_KEY,
  clearStoredAuthSession,
  deleteAuthToken,
  getAuthToken,
  setAuthToken,
} from "@/services/authStorage";

const secureStoreMock = SecureStore as typeof SecureStore & {
  __reset: jest.Mock;
};

describe("authStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    secureStoreMock.__reset();
  });

  it("stores auth tokens only in SecureStore", async () => {
    await setAuthToken("secure-token");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      AUTH_TOKEN_KEY,
      "secure-token",
      { keychainService: "aleefna.auth" },
    );
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(await getAuthToken()).toBe("secure-token");
  });

  it("migrates a legacy AsyncStorage token once", async () => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, "legacy-token");

    await expect(getAuthToken()).resolves.toBe("legacy-token");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      AUTH_TOKEN_KEY,
      "legacy-token",
      { keychainService: "aleefna.auth" },
    );
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("deletes SecureStore and legacy token copies on logout/session clear", async () => {
    await setAuthToken("secure-token");
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, "legacy-token");
    await AsyncStorage.setItem("auth_user", "{}");
    await AsyncStorage.setItem("cache_key", "value");

    await clearStoredAuthSession(["cache_key"]);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      AUTH_TOKEN_KEY,
      { keychainService: "aleefna.auth" },
    );
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(await AsyncStorage.getItem("auth_user")).toBeNull();
    expect(await AsyncStorage.getItem("cache_key")).toBeNull();

    await deleteAuthToken();
    await expect(getAuthToken()).resolves.toBeNull();
  });
});
