import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import { router } from "expo-router";

import { getExistingExpoPushToken } from "../services/pushNotifications";
import { setUnauthorizedHandler } from "@/services/apiClient";
import {
  clearStoredAuthSession,
  deleteStoredUser,
  deleteTempEmail,
  getAuthToken,
  getStoredUser,
  getTempEmail,
  setAuthToken,
  setStoredUser,
  setTempEmail,
} from "@/services/authStorage";
import { clearCareWidgetSnapshot } from "@/services/careWidget";
import {
  forgotPasswordRequest,
  getAuthErrorMessage,
  getAuthValidationErrors,
  getProfileRequest,
  isAuthUnauthorized,
  loginRequest,
  logoutRequest,
  registerRequest,
  resendOtpRequest,
  resetPasswordRequest,
  socialLoginRequest,
  updateProfileRequest,
  verifyForgotOtpRequest,
  verifyOtpRequest,
  type AuthUser,
  type SocialLoginRequest,
} from "@/src/features/auth/api/authApi";
import { unregisterDeviceTokenRequest } from "@/src/features/notifications/api/notificationsApi";
import {
  CONNECTION_ERROR_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from "@/utils/userMessages";
import { devError, devWarn } from "@/utils/logger";
import type { FieldErrors } from "@/types/adoption";
import { clearPendingDeepLink } from "@/services/pendingDeepLink";
import { setMonitoringUserId } from "@/services/monitoring";

const PETS_CACHE_KEY = "my_pets_cache";
const BROWSE_CACHE_KEY = "browse_pets_cache";
const MATCHES_CACHE_KEY = "matches_cache";
const NOTIFICATIONS_CACHE_KEY = "notifications_cache";

const SESSION_CACHE_KEYS = [
  PETS_CACHE_KEY,
  BROWSE_CACHE_KEY,
  MATCHES_CACHE_KEY,
  NOTIFICATIONS_CACHE_KEY,
];

function debugLog(label: string, details: Record<string, unknown>) {
  if (!__DEV__) return;

  console.log(label, details);
}

export type User = AuthUser;

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<{
    success: boolean;
    message?: string;
    needsOtp?: boolean;
    user?: User;
  }>;

  register: (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{
    success: boolean;
    message?: string;
    email?: string;
    errors?: FieldErrors;
  }>;

  socialLogin: (payload: SocialLoginRequest) => Promise<{
    success: boolean;
    message?: string;
    user?: User;
  }>;

  logout: () => Promise<void>;

  verifyOtp: (otp: string) => Promise<{
    success: boolean;
    message?: string;
    errors?: FieldErrors;
  }>;

  resendOtp: () => Promise<{
    success: boolean;
    message?: string;
  }>;

  forgotPassword: (email: string) => Promise<{
    success: boolean;
    message?: string;
  }>;

  verifyForgotOtp: (
    email: string,
    otp: string
  ) => Promise<{
    success: boolean;
    message?: string;
    resetToken?: string | null;
  }>;

  resetPassword: (
    email: string,
    password: string,
    resetToken: string
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;

  updateProfile: (data: Partial<User>) => Promise<{
    success: boolean;
    message?: string;
    errors?: FieldErrors;
  }>;

  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalSession = useCallback(async () => {
    try {
      await Promise.all([
        clearStoredAuthSession(SESSION_CACHE_KEYS),
        clearPendingDeepLink(),
      ]);
    } finally {
      clearCareWidgetSnapshot();
      setToken(null);
      setUser(null);
      setMonitoringUserId(null);
    }
  }, []);

  useEffect(() => {
    setMonitoringUserId(user?.id);
  }, [user?.id]);

  const persistAuthenticatedSession = useCallback(
    async (authToken: string, userData: User) => {
      await Promise.all([
        setAuthToken(authToken),
        setStoredUser(userData),
        deleteTempEmail(),
      ]);

      setToken(authToken);
      setUser(userData);
    },
    [],
  );

  useEffect(() => {
    return setUnauthorizedHandler(async () => {
      try {
        await clearLocalSession();
      } finally {
        router.replace("/login");
      }
    });
  }, [clearLocalSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedToken = await getAuthToken();
        const savedUser = await getStoredUser();

        if (savedToken) {
          setToken(savedToken);

          if (savedUser) {
            try {
              const parsedUser = JSON.parse(savedUser);
              setUser(parsedUser);
            } catch {
              await deleteStoredUser();
            }
          }

          await fetchProfile(savedToken);
        }
      } catch {
        devError("Bootstrap error.");
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(
    currentToken: string,
    retries = 2
  ): Promise<boolean> {
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await getProfileRequest(currentToken);

        if (result.data?.user) {
          const latestUser = result.data.user;
          setUser(latestUser);
          await setStoredUser(latestUser);
          return true;
        }

        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        return false;
      } catch (error) {
        if (isAuthUnauthorized(error)) {
          return false;
        }

        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        return false;
      }
    }

    return false;
  }

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchProfile(token);
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      if (!email?.trim() || !password?.trim()) {
        return {
          success: false,
          message: "Email and password are required.",
        };
      }

      const result = await loginRequest({ email, password });
      const userData = result.data?.user ?? null;
      const authToken = result.data?.token ?? null;
      const requiresVerification = result.data?.requires_verification ?? false;

      if (!userData) {
        return {
          success: false,
          message: GENERIC_ERROR_MESSAGE,
        };
      }

      if (requiresVerification) {
        await setTempEmail(email);

        return {
          success: false,
          needsOtp: true,
          user: userData,
          message: result.message || "Please verify your email first.",
        };
      }

      if (authToken) {
        await persistAuthenticatedSession(authToken, userData);

        return {
          success: true,
          message: result.message || "Login successful.",
          user: userData,
        };
      }

      return {
        success: false,
        message: GENERIC_ERROR_MESSAGE,
      };
    } catch (error) {
      return {
        success: false,
        message: isAuthUnauthorized(error)
          ? "Email or password is incorrect."
          : getAuthErrorMessage(error, CONNECTION_ERROR_MESSAGE),
      };
    }
  }, [persistAuthenticatedSession]);

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      try {
        const result = await registerRequest({ name, email, password, phone });

        await setTempEmail(email);

        return {
          success: true,
          message: result.message,
          email,
        };
      } catch (error) {
        return {
          success: false,
          message: getAuthErrorMessage(
            error,
            "Registration failed. Please try again.",
          ),
          errors: getAuthValidationErrors(error),
        };
      }
    },
    []
  );

  const socialLogin = useCallback(
    async (payload: SocialLoginRequest) => {
      try {
        debugLog("[AuthContext.socialLogin] start", {
          provider: payload.provider,
        });

        const result = await socialLoginRequest(payload);
        const userData = result.data?.user ?? null;
        const authToken = result.data?.token ?? null;

        debugLog("[AuthContext.socialLogin] response", {
          success: result.success,
          message: result.message,
          hasData: Boolean(result.data),
          hasSession: Boolean(userData && authToken),
          hasToken: Boolean(authToken),
        });

        if (!userData || !authToken) {
          return {
            success: false,
            message: GENERIC_ERROR_MESSAGE,
          };
        }

        await persistAuthenticatedSession(authToken, userData);

        return {
          success: true,
          message: result.message || "Login successful.",
          user: userData,
        };
      } catch (error) {
        return {
          success: false,
          message: isAuthUnauthorized(error)
            ? "Social sign in failed. Please try again."
            : getAuthErrorMessage(
                error,
                "Social sign in failed. Please try again.",
              ),
        };
      }
    },
    [persistAuthenticatedSession],
  );

  const verifyOtp = useCallback(
    async (otp: string) => {
      try {
        const email = user?.email ?? (await getTempEmail());

        if (!email) {
          return {
            success: false,
            message: "We could not find the email for this code. Please start again.",
          };
        }

        if (!otp || otp.length !== 6) {
          return { success: false, message: "Enter the 6-digit code." };
        }

        const result = await verifyOtpRequest({ email, otp });
        const authToken = result.data?.token ?? null;
        const userData = result.data?.user ?? null;

        if (authToken) {
          await setAuthToken(authToken);
          setToken(authToken);
        }

        if (userData) {
          setUser(userData);
          await setStoredUser(userData);
        }

        await deleteTempEmail();

        return {
          success: true,
          message: result.message || "Verification successful",
        };
      } catch (error) {
        return {
          success: false,
          message: getAuthErrorMessage(
            error,
            "That code was not accepted. Please try again.",
          ),
          errors: getAuthValidationErrors(error),
        };
      }
    },
    [user]
  );

  const resendOtp = useCallback(async () => {
    try {
      const email = user?.email ?? (await getTempEmail());

      if (!email) {
        return {
          success: false,
          message: "We could not find the email for this code. Please start again.",
        };
      }

      const result = await resendOtpRequest(email);

      return {
        success: true,
        message: result.message || "OTP sent",
      };
    } catch (error) {
      return {
        success: false,
        message: getAuthErrorMessage(
          error,
          "We could not resend the code. Please try again.",
        ),
      };
    }
  }, [user]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        try {
          const expoPushToken = await getExistingExpoPushToken();

          if (expoPushToken) {
            await unregisterDeviceTokenRequest(token, { token: expoPushToken });
          }
        } catch (error) {
          devWarn(
            "[AuthContext] Push token unregister failed.",
            getAuthErrorMessage(error, "Device token unregister failed."),
          );
        }

        try {
          await logoutRequest(token);
        } catch (error) {
          devWarn(
            "[AuthContext] Logout API request failed.",
            getAuthErrorMessage(error, "Logout request failed."),
          );
        }
      }

      await clearLocalSession();
    } catch {
      devError("Logout error.");
    }
  }, [clearLocalSession, token]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      const result = await forgotPasswordRequest(email);

      return {
        success: true,
        message: result.message || "OTP sent",
      };
    } catch (error) {
      return {
        success: false,
        message: getAuthErrorMessage(
          error,
          "We could not send a reset code. Please try again.",
        ),
      };
    }
  }, []);

  const verifyForgotOtp = useCallback(async (email: string, otp: string) => {
    try {
      const result = await verifyForgotOtpRequest({ email, otp });

      const resetToken =
        result.data?.reset_token ?? result.data?.resetToken ?? null;

      return {
        success: true,
        message: result.message || "OTP verified",
        resetToken,
      };
    } catch (error) {
      return {
        success: false,
        message: getAuthErrorMessage(
          error,
          "That code was not accepted. Please try again.",
        ),
      };
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string, password: string, resetToken: string) => {
      try {
        const result = await resetPasswordRequest({
          email,
          password,
          resetToken,
        });

        return {
          success: true,
          message: result.message || "Password reset successfully",
        };
      } catch (error) {
        return {
          success: false,
          message: getAuthErrorMessage(
            error,
            "We could not reset your password. Please try again.",
          ),
        };
      }
    },
    []
  );

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      if (!token) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      try {
        const result = await updateProfileRequest(token, data);

        const updatedUser = result.data?.user;

        if (updatedUser) {
          setUser(updatedUser);
          await setStoredUser(updatedUser);
        }

        return {
          success: true,
          message: result.message || "Profile updated",
        };
      } catch (error) {
        return {
          success: false,
          message: isAuthUnauthorized(error)
            ? SESSION_EXPIRED_MESSAGE
            : getAuthErrorMessage(
                error,
                "We could not update your profile. Please try again.",
              ),
          errors: getAuthValidationErrors(error),
        };
      }
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        register,
        socialLogin,
        logout,
        verifyOtp,
        resendOtp,
        forgotPassword,
        verifyForgotOtp,
        resetPassword,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
