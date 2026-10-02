import { resolveNotificationRoute } from "@/src/features/notifications/utils/notificationRoutes";

describe("notification route resolver", () => {
  it("prefers explicit deep links", () => {
    expect(
      resolveNotificationRoute({
        type: "adoption_conversation",
        adoption_conversation_id: 77,
        deep_link: "/adopt/10",
      }),
    ).toBe("/adopt/10");
  });

  it("routes adoption conversation ids to adoption chat", () => {
    expect(
      resolveNotificationRoute({
        type: "adoption_conversation",
        adoption_conversation_id: 77,
      }),
    ).toBe("/adoption-chat/77");
  });

  it("routes normal conversation ids to chat with a conversation param", () => {
    expect(
      resolveNotificationRoute({
        type: "conversation",
        conversationId: 44,
      }),
    ).toEqual({
      pathname: "/chat/[matchId]",
      params: {
        matchId: "44",
        conversationId: "44",
      },
    });
  });

  it("routes new adoption applications to the owner application list", () => {
    expect(
      resolveNotificationRoute({
        data: {
          type: "adoption.application.created",
          adoptionListingId: 10,
          adoptionApplicationId: 5,
        },
      }),
    ).toBe("/my-adoption-listings/10/applications");
  });

  it("falls back to notifications for malformed payloads", () => {
    expect(resolveNotificationRoute(null)).toBe("/(tabs)/notifications");
  });
});
