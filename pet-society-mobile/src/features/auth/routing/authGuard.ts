export type AuthRouteState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

export function getAuthRouteAvailability({
  isAuthenticated,
  isLoading,
}: AuthRouteState) {
  return {
    canUseAuthRoutes: isLoading || !isAuthenticated,
    canUseProtectedRoutes: !isLoading && isAuthenticated,
  };
}
