import { normalizeAppCounts } from "@/src/features/app/api/appCountsApi";

describe("app counts api", () => {
  it("normalizes count payload from api envelope", () => {
    expect(
      normalizeAppCounts({
        unread_notifications: 3,
        unread_match_chats: 2,
        unread_adoption_chats: 1,
        pending_adoption_applications: 4,
        my_active_applications: 5,
        new_matches: 1,
      }),
    ).toEqual({
      unread_notifications: 3,
      unread_match_chats: 2,
      unread_adoption_chats: 1,
      pending_adoption_applications: 4,
      my_active_applications: 5,
      new_matches: 1,
      total_match_chats: 0,
      total_adoption_chats: 0,
      owner_pending_applications: 0,
      applicant_pending_applications: 0,
      applicant_approved_applications: 0,
      applicant_withdrawn_applications: 0,
      applicant_rejected_applications: 0,
    });
  });
});
