import type * as Notifications from "expo-notifications";

import { getForegroundNotificationBehavior } from "@/services/pushNotifications";
import {
  setActiveAdoptionConversationId,
  setActiveConversationId,
} from "@/services/inAppMessageBus";

function notification(data: Record<string, unknown>) {
  return {
    request: {
      content: {
        data,
      },
    },
  } as Notifications.Notification;
}

describe("push notification foreground policy", () => {
  afterEach(() => {
    setActiveConversationId(null);
    setActiveAdoptionConversationId(null);
  });

  it("suppresses foreground match banners handled by realtime UI", () => {
    expect(
      getForegroundNotificationBehavior(notification({ type: "match.created" })),
    ).toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it("shows foreground message notifications", () => {
    expect(
      getForegroundNotificationBehavior(notification({ type: "message.sent" })),
    ).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  it("suppresses only the currently open normal chat message notification", () => {
    setActiveConversationId("44");

    expect(
      getForegroundNotificationBehavior(
        notification({ type: "message", conversation_id: "44" }),
      ),
    ).toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });

    expect(
      getForegroundNotificationBehavior(
        notification({ type: "message", conversation_id: "45" }),
      ),
    ).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  it("suppresses only the currently open adoption chat notification", () => {
    setActiveAdoptionConversationId("77");

    expect(
      getForegroundNotificationBehavior(
        notification({
          type: "adoption_conversation",
          adoption_conversation_id: "77",
        }),
      ),
    ).toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });

    expect(
      getForegroundNotificationBehavior(
        notification({
          type: "adoption_conversation",
          adoption_conversation_id: "78",
        }),
      ),
    ).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  it("shows foreground local care reminders", () => {
    expect(
      getForegroundNotificationBehavior(
        notification({
          source: "aleefna_local_pet_reminder",
          type: "care_streak",
        }),
      ),
    ).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });
});
