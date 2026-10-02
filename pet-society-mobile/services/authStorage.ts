import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";
export const TEMP_EMAIL_KEY = "temp_email";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "aleefna.auth",
};

async function removeLegacyAuthToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY).catch(() => undefined);
}

export async function getAuthToken(): Promise<string | null> {
  const secureToken = await SecureStore.getItemAsync(
    AUTH_TOKEN_KEY,
    SECURE_STORE_OPTIONS,
  );

  if (secureToken) {
    await removeLegacyAuthToken();
    return secureToken;
  }

  const legacyToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (!legacyToken) {
    return null;
  }

  await SecureStore.setItemAsync(
    AUTH_TOKEN_KEY,
    legacyToken,
    SECURE_STORE_OPTIONS,
  );
  await removeLegacyAuthToken();

  return legacyToken;
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, SECURE_STORE_OPTIONS);
  await removeLegacyAuthToken();
}

export async function deleteAuthToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_TOKEN_KEY, SECURE_STORE_OPTIONS),
    removeLegacyAuthToken(),
  ]);
}

export function getStoredUser(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_USER_KEY);
}

export function setStoredUser(user: unknown): Promise<void> {
  return AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function deleteStoredUser(): Promise<void> {
  return AsyncStorage.removeItem(AUTH_USER_KEY);
}

export function getTempEmail(): Promise<string | null> {
  return AsyncStorage.getItem(TEMP_EMAIL_KEY);
}

export function setTempEmail(email: string): Promise<void> {
  return AsyncStorage.setItem(TEMP_EMAIL_KEY, email);
}

export function deleteTempEmail(): Promise<void> {
  return AsyncStorage.removeItem(TEMP_EMAIL_KEY);
}

export async function clearStoredAuthSession(
  extraAsyncStorageKeys: string[] = [],
): Promise<void> {
  await Promise.all(
    [
      deleteAuthToken(),
      ...[AUTH_USER_KEY, TEMP_EMAIL_KEY, ...extraAsyncStorageKeys].map((key) =>
        AsyncStorage.removeItem(key),
      ),
    ],
  );
}
