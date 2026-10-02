import {
  extractRealtimeAdoptionMessage,
  extractRealtimeMatchId,
  extractRealtimeMessage,
  shouldProcessDedupeKey,
} from "@/src/features/pets/services/petsRealtime";

describe("pets realtime payload normalization", () => {
  it("extracts match ids from top-level and nested payloads", () => {
    expect(extractRealtimeMatchId({ type: "match", match_id: 42 })).toBe("42");
    expect(
      extractRealtimeMatchId(
        JSON.stringify({
          notification: {
            data: {
              match_id: "43",
            },
          },
        }),
      ),
    ).toBe("43");
  });

  it("normalizes normal message routing type to message kind", () => {
    const message = extractRealtimeMessage({
      type: "message",
      event: "message.sent",
      message_id: 10,
      id: 10,
      conversation_id: 20,
      match_id: 30,
      sender_id: 40,
      message_type: "image",
      body: null,
      attachments: [],
    });

    expect(message?.id).toBe(10);
    expect(message?.conversation_id).toBe(20);
    expect(message?.type).toBe("image");
  });

  it("normalizes adoption routing type to message kind", () => {
    const message = extractRealtimeAdoptionMessage({
      type: "adoption_conversation",
      event: "adoption.message.sent",
      message_id: 10,
      id: 10,
      adoption_conversation_id: 20,
      sender_id: 40,
      message_type: "location",
      body: null,
      attachments: [],
    });

    expect(message?.id).toBe(10);
    expect(message?.adoption_conversation_id).toBe(20);
    expect(message?.type).toBe("location");
  });

  it("dedupes only repeated keys", () => {
    const cache = new Map<string, number>();

    expect(shouldProcessDedupeKey({ cache, key: "a", label: "test" })).toBe(true);
    expect(shouldProcessDedupeKey({ cache, key: "a", label: "test" })).toBe(false);
    expect(shouldProcessDedupeKey({ cache, key: "b", label: "test" })).toBe(true);
    expect(shouldProcessDedupeKey({ cache, key: null, label: "test" })).toBe(true);
  });
});
