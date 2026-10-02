import { getAuthRouteAvailability } from "@/src/features/auth/routing/authGuard";

describe("auth route guard", () => {
  it("keeps protected routes unavailable while auth is hydrating", () => {
    expect(
      getAuthRouteAvailability({
        isAuthenticated: false,
        isLoading: true,
      }),
    ).toEqual({
      canUseAuthRoutes: true,
      canUseProtectedRoutes: false,
    });
  });

  it("allows auth routes and blocks protected routes for logged-out users", () => {
    expect(
      getAuthRouteAvailability({
        isAuthenticated: false,
        isLoading: false,
      }),
    ).toEqual({
      canUseAuthRoutes: true,
      canUseProtectedRoutes: false,
    });
  });

  it("blocks auth routes and allows protected routes for authenticated users", () => {
    expect(
      getAuthRouteAvailability({
        isAuthenticated: true,
        isLoading: false,
      }),
    ).toEqual({
      canUseAuthRoutes: false,
      canUseProtectedRoutes: true,
    });
  });
});
