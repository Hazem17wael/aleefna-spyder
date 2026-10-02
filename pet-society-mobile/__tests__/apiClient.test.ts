import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  apiRequest,
  getApiErrorMessage,
  getApiValidationErrors,
  normalizeFieldErrors,
  setUnauthorizedHandler,
} from "@/services/apiClient";

function jsonResponse(body: unknown, init: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("apiClient", () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    jest.restoreAllMocks();
  });

  it("normalizes validation errors and user-safe error messages", () => {
    const errors = normalizeFieldErrors({
      email: ["Email is required.", "Email is invalid."],
      name: "Name is required.",
      ignored: null,
    });

    expect(errors).toEqual({
      email: "Email is required.\nEmail is invalid.",
      name: "Name is required.",
    });

    const error = new ApiError({
      message: "Backend message",
      status: 422,
      code: "ALREADY_APPLIED",
      errors,
    });

    expect(
      getApiErrorMessage(error, "Fallback", {
        ALREADY_APPLIED: "You already applied.",
      }),
    ).toBe("You already applied.");
    expect(getApiValidationErrors(error)).toEqual(errors);
  });

  it("calls the unauthorized handler for API 401 responses", async () => {
    const unauthorizedHandler = jest.fn();
    setUnauthorizedHandler(unauthorizedHandler);
    jest.spyOn(Date, "now").mockReturnValue(20_000);
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        { success: false, message: "Unauthenticated." },
        { status: 401 },
      ),
    );

    await expect(apiRequest("token", "/api/protected")).rejects.toMatchObject({
      status: 401,
      message: "Unauthenticated.",
    });

    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
  });

  it("maps network failures to a safe connection message", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("socket hang up"),
    );

    await expect(apiRequest("token", "/api/pets")).rejects.toMatchObject({
      status: 0,
      message: NETWORK_ERROR_MESSAGE,
    });
  });
});
