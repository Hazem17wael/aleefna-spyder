// context/PetsContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

import { useAuth } from "./AuthContext";
import {
  getExistingExpoPushToken,
  getExpoPushToken,
  getNotificationPermissionStatus,
} from "../services/pushNotifications";
import { emitMatchPopup } from "../services/matchPopupBus";
import { getApiErrorMessage } from "@/services/apiClient";
import type { MessageAttachment } from "@/services/chat/messageAttachments";
import type { Pet } from "@/types/pet";
import { normalizePetList } from "@/utils/pets";
import {
  emitInAppMessageBanner,
  getActiveAdoptionConversationId,
  getActiveConversationId,
} from "../services/inAppMessageBus";
import { devError, devLog, devWarn } from "@/utils/logger";
import { getAdoptionConversations } from "@/services/adoptionApi";
import {
  markLiveDebugAppCountsRefresh,
  setLiveDebugPushPermissionStatus,
  setLiveDebugPushTokenRegistered,
  setLiveDebugUserId,
} from "@/services/liveDebug";
import {
  fetchAppCounts,
  type AppCounts,
} from "@/src/features/app/api/appCountsApi";
import type { AdoptionConversation } from "@/types/adoption";
import {
  createPetRequest,
  deletePetRequest,
  fetchBrowsePetsRequest,
  fetchMyPetsRequest,
  updatePetRequest,
  type BrowseCursor,
} from "@/src/features/pets/api/petsApi";
import {
  fetchMatchesRequest,
  normalizeMatchDocuments,
} from "@/src/features/matches/api/matchesApi";
import {
  dislikePetRequest,
  likePetRequest,
} from "@/src/features/swipe/api/swipeApi";
import {
  getNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  registerDeviceTokenRequest,
  type AppNotification,
} from "@/src/features/notifications/api/notificationsApi";
import {
  connectPetsRealtime,
  extractRealtimeAdoptionMessage,
  extractRealtimeMatchId,
  extractRealtimeMessage,
  shouldProcessDedupeKey,
  shouldUsePetsRealtime,
  type RealtimeAdoptionMessage,
  type RealtimeChatMessage,
} from "@/src/features/pets/services/petsRealtime";
import {
  getRealtimePusherConnectionState,
  isSharedRealtimePusherConnectionUsable,
} from "@/services/realtimeClient";
import {
  clearPetsCareWidgetSnapshot,
  syncPetsCareWidgetSnapshot,
} from "@/src/features/pets/services/petsWidgetSync";

const CACHE_VERSION = "v2";
const PETS_CACHE_KEY = `cache_my_pets_${CACHE_VERSION}`;

type Cursor = BrowseCursor;

type BrowseFilters = {
  petId?: string | number;
  radius?: string | number;
  limit?: string | number;
  cursor?: Cursor | null;
  append?: boolean;
};

export type { Pet, PetImage } from "@/types/pet";

export type Match = {
  id: string | number;
  matched_at: string;

  pet_one?: Pet | null;
  pet_two?: Pet | null;
  my_pet?: Pet;
  matched_pet?: Pet;

  conversation_id?: string | number | null;

  last_message?: {
    id: string | number;
    conversation_id?: string | number;
    sender_id?: string | number;
    type?: string;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
    attachment?: MessageAttachment | null;
    attachments?: MessageAttachment[];
    created_at?: string | null;
    updated_at?: string | null;
  } | null;

  unread_count?: number;
};

export type ChatMessageLike = RealtimeChatMessage;
export type Notification = AppNotification;

type PetsContextType = {
  myPets: Pet[];
  browsePets: Pet[];
  matches: Match[];
  notifications: Notification[];
  isLoading: boolean;
  hasMore: boolean;
  nextCursor: Cursor | null;

  fetchMyPets: () => Promise<Pet[]>;
  fetchBrowsePets: (filters?: BrowseFilters) => Promise<Pet[]>;
  fetchMatches: () => Promise<void>;
  fetchNotifications: () => Promise<void>;

  createPet: (data: FormData) => Promise<Pet | null>;
  updatePet: (id: string, data: FormData) => Promise<Pet | null>;
  deletePet: (id: string) => Promise<boolean>;

  likePet: (
    fromPetId: string,
    toPetId: string,
  ) => Promise<{ matched: boolean; match?: Match }>;

  dislikePet: (fromPetId: string, toPetId: string) => Promise<void>;

  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  registerDeviceToken: () => Promise<void>;
  refreshRealtimeConnection: () => Promise<void>;

  updateMatchLastMessage: (message: ChatMessageLike) => void;
  incrementUnreadForConversation: (message: ChatMessageLike) => void;
  markConversationReadLocal: (conversationId: string | number) => void;
  removeMatchLocal: (matchId: string | number) => void;
  removeMatchesForUserLocal: (userId: string | number) => void;
  removeBrowsePetsForUserLocal: (userId: string | number) => void;

  adoptionConversations: AdoptionConversation[];
  fetchAdoptionConversations: () => Promise<void>;
  updateAdoptionLastMessage: (message: RealtimeAdoptionMessage) => void;
  incrementAdoptionUnread: (message: RealtimeAdoptionMessage) => void;
  markAdoptionConversationReadLocal: (conversationId: string | number) => void;

  appCounts: AppCounts | null;
  refreshAppCounts: () => Promise<void>;
  chatUnreadCount: number;

  unreadCount: number;
};

const PetsContext = createContext<PetsContextType | null>(null);

export function PetsProvider({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading: isAuthLoading } = useAuth();

  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [browsePets, setBrowsePets] = useState<Pet[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [adoptionConversations, setAdoptionConversations] = useState<
    AdoptionConversation[]
  >([]);
  const [appCounts, setAppCounts] = useState<AppCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);

  const myPetsRef = useRef<Pet[]>([]);
  const matchesRef = useRef<Match[]>([]);
  const adoptionConversationsRef = useRef<AdoptionConversation[]>([]);
  const realtimeDisconnectRef = useRef<null | (() => void)>(null);
  const realtimeConnectionKeyRef = useRef<string | null>(null);

  const registeredPushTokenRef = useRef<string | null>(null);
  const registeringPushTokenRef = useRef(false);

  const processedNotificationEventsRef = useRef<Map<string, number>>(new Map());
  const processedMatchReconcileEventsRef = useRef<Map<string, number>>(new Map());
  const emittedMatchPopupsRef = useRef<Map<string, number>>(new Map());
  const processedMessageEventsRef = useRef<Map<string, number>>(new Map());
  const processedAdoptionMessageEventsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    myPetsRef.current = myPets;
  }, [myPets]);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  useEffect(() => {
    adoptionConversationsRef.current = adoptionConversations;
  }, [adoptionConversations]);

  useEffect(() => {
    loadCachedPets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) {
      fetchMyPets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!token) {
      setMyPets([]);
      setBrowsePets([]);
      setMatches([]);
      setNotifications([]);
      setAdoptionConversations([]);
      setAppCounts(null);
      setHasMore(false);
      setNextCursor(null);

      registeredPushTokenRef.current = null;
      registeringPushTokenRef.current = false;
      processedNotificationEventsRef.current.clear();
      processedMatchReconcileEventsRef.current.clear();
      emittedMatchPopupsRef.current.clear();
      processedMessageEventsRef.current.clear();
      processedAdoptionMessageEventsRef.current.clear();
      clearPetsCareWidgetSnapshot();

      if (realtimeDisconnectRef.current) {
        realtimeDisconnectRef.current();
        realtimeDisconnectRef.current = null;
      }
      realtimeConnectionKeyRef.current = null;
    }
  }, [isAuthLoading, token]);

  useEffect(() => {
    if (!token) return;

    void syncPetsCareWidgetSnapshot({
      enabled: Boolean(token),
      userId: user?.id,
      pets: myPets,
    });
  }, [myPets, token, user?.id]);

  const loadCachedPets = async () => {
    try {
      const cached = await AsyncStorage.getItem(PETS_CACHE_KEY);

      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        setMyPets(normalizePetList(parsed, "cache"));
      }
    } catch {
      devWarn("[PetsContext] Failed to load cached pets.");
    }
  };

  const savePetsToCache = async (pets: Pet[]) => {
    try {
      await AsyncStorage.setItem(PETS_CACHE_KEY, JSON.stringify(pets));
    } catch {
      devWarn("[PetsContext] Failed to cache pets.");
    }
  };

  const shouldProcessNotificationEvent = useCallback((payload: unknown): boolean => {
    const notification =
      payload && typeof payload === "object"
        ? (payload as { notification?: { id?: unknown } }).notification
        : null;
    const notificationId = notification?.id;

    return shouldProcessDedupeKey({
      cache: processedNotificationEventsRef.current,
      key: notificationId == null ? null : String(notificationId),
      label: "notification",
    });
  }, []);

  const shouldProcessMessageEvent = useCallback((message: ChatMessageLike): boolean => {
    return shouldProcessDedupeKey({
      cache: processedMessageEventsRef.current,
      key: message?.id == null ? null : String(message.id),
      label: "normal_message",
    });
  }, []);

  const shouldEmitMatchPopup = useCallback((payload: unknown): boolean => {
    const matchId = extractRealtimeMatchId(payload);

    return shouldProcessDedupeKey({
      cache: emittedMatchPopupsRef.current,
      key: matchId,
      label: "match_popup",
    });
  }, []);

  const shouldReconcileMatchEvent = useCallback((payload: unknown): boolean => {
    const matchId = extractRealtimeMatchId(payload);

    return shouldProcessDedupeKey({
      cache: processedMatchReconcileEventsRef.current,
      key: matchId,
      label: "match_reconcile",
    });
  }, []);

  const sortMatchesByActivity = useCallback((items: Match[]): Match[] => {
    return [...items].sort((a, b) => {
      const aDate = a.last_message?.created_at ?? a.matched_at ?? "";
      const bDate = b.last_message?.created_at ?? b.matched_at ?? "";

      const aTime = new Date(aDate).getTime();
      const bTime = new Date(bDate).getTime();

      return (
        (Number.isNaN(bTime) ? 0 : bTime) -
        (Number.isNaN(aTime) ? 0 : aTime)
      );
    });
  }, []);

  const updateMatchLastMessage = useCallback(
    (message: ChatMessageLike) => {
      if (message?.conversation_id == null) return;

      setMatches((prev) => {
        const updated = prev.map((match) => {
          if (String(match.conversation_id) !== String(message.conversation_id)) {
            return match;
          }

          return {
            ...match,
            last_message: {
              id: message.id,
              conversation_id: message.conversation_id,
              sender_id: message.sender_id ?? 0,
              type: message.type ?? "text",
              body: message.body ?? "",
              metadata: message.metadata ?? null,
              attachment: message.attachment ?? null,
              attachments: message.attachments ?? [],
              created_at: message.created_at ?? new Date().toISOString(),
              updated_at: message.updated_at ?? null,
            },
          };
        });

        return sortMatchesByActivity(updated);
      });
    },
    [sortMatchesByActivity],
  );

  const incrementUnreadForConversation = useCallback(
    (message: ChatMessageLike) => {
      if (message?.conversation_id == null) return;

      setMatches((prev) => {
        const updated = prev.map((match) => {
          if (String(match.conversation_id) !== String(message.conversation_id)) {
            return match;
          }

          return {
            ...match,
            last_message: {
              id: message.id,
              conversation_id: message.conversation_id,
              sender_id: message.sender_id ?? 0,
              type: message.type ?? "text",
              body: message.body ?? "",
              metadata: message.metadata ?? null,
              attachment: message.attachment ?? null,
              attachments: message.attachments ?? [],
              created_at: message.created_at ?? new Date().toISOString(),
              updated_at: message.updated_at ?? null,
            },
            unread_count: Number(match.unread_count ?? 0) + 1,
          };
        });

        return sortMatchesByActivity(updated);
      });
    },
    [sortMatchesByActivity],
  );

  const shouldProcessAdoptionMessageEvent = useCallback(
    (message: RealtimeAdoptionMessage): boolean => {
      return shouldProcessDedupeKey({
        cache: processedAdoptionMessageEventsRef.current,
        key: message?.id == null ? null : String(message.id),
        label: "adoption_message",
      });
    },
    [],
  );

  const sortAdoptionConversationsByActivity = useCallback(
    (items: AdoptionConversation[]) => {
      return [...items].sort((a, b) => {
        const aDate =
          a.last_message?.created_at ?? a.last_message_at ?? a.created_at ?? "";
        const bDate =
          b.last_message?.created_at ?? b.last_message_at ?? b.created_at ?? "";

        const aTime = new Date(aDate).getTime();
        const bTime = new Date(bDate).getTime();

        return (
          (Number.isNaN(bTime) ? 0 : bTime) -
          (Number.isNaN(aTime) ? 0 : aTime)
        );
      });
    },
    [],
  );

  const updateAdoptionLastMessage = useCallback(
    (message: RealtimeAdoptionMessage) => {
      if (message?.adoption_conversation_id == null) return;

      setAdoptionConversations((prev) => {
        const updated = prev.map((conversation) => {
          if (
            String(conversation.id) !==
            String(message.adoption_conversation_id)
          ) {
            return conversation;
          }

          return {
            ...conversation,
            last_message: {
              id: message.id,
              adoption_conversation_id: message.adoption_conversation_id,
              sender_id: message.sender_id ?? 0,
              type: message.type ?? "text",
              body: message.body ?? "",
              metadata: message.metadata ?? null,
              attachment: message.attachment ?? null,
              attachments: message.attachments ?? [],
              created_at: message.created_at ?? new Date().toISOString(),
              updated_at: message.updated_at ?? null,
            },
            last_message_at: message.created_at ?? conversation.last_message_at,
          };
        });

        return sortAdoptionConversationsByActivity(updated);
      });
    },
    [sortAdoptionConversationsByActivity],
  );

  const incrementAdoptionUnread = useCallback(
    (message: RealtimeAdoptionMessage) => {
      if (message?.adoption_conversation_id == null) return;

      setAdoptionConversations((prev) => {
        const updated = prev.map((conversation) => {
          if (
            String(conversation.id) !==
            String(message.adoption_conversation_id)
          ) {
            return conversation;
          }

          return {
            ...conversation,
            last_message: {
              id: message.id,
              adoption_conversation_id: message.adoption_conversation_id,
              sender_id: message.sender_id ?? 0,
              type: message.type ?? "text",
              body: message.body ?? "",
              metadata: message.metadata ?? null,
              attachment: message.attachment ?? null,
              attachments: message.attachments ?? [],
              created_at: message.created_at ?? new Date().toISOString(),
              updated_at: message.updated_at ?? null,
            },
            last_message_at: message.created_at ?? conversation.last_message_at,
            unread_count: Number(conversation.unread_count ?? 0) + 1,
          };
        });

        return sortAdoptionConversationsByActivity(updated);
      });
    },
    [sortAdoptionConversationsByActivity],
  );

  const markAdoptionConversationReadLocal = useCallback(
    (conversationId: string | number) => {
      setAdoptionConversations((prev) =>
        prev.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? {
                ...conversation,
                unread_count: 0,
              }
            : conversation,
        ),
      );
    },
    [],
  );

  const markConversationReadLocal = useCallback(
    (conversationId: string | number) => {
      setMatches((prev) =>
        prev.map((match) =>
          String(match.conversation_id) === String(conversationId)
            ? {
              ...match,
              unread_count: 0,
            }
            : match,
        ),
      );
    },
    [],
  );

  const removeMatchLocal = useCallback((matchId: string | number) => {
    setMatches((prev) =>
      prev.filter((match) => String(match.id) !== String(matchId)),
    );
  }, []);

  const removeMatchesForUserLocal = useCallback((userId: string | number) => {
    setMatches((prev) =>
      prev.filter((match) => {
        const candidates = [
          match.pet_one?.user_id,
          match.pet_two?.user_id,
          match.my_pet?.user_id,
          match.matched_pet?.user_id,
        ];

        return !candidates.some((candidate) => String(candidate) === String(userId));
      }),
    );
  }, []);

  const removeBrowsePetsForUserLocal = useCallback((userId: string | number) => {
    setBrowsePets((prev) =>
      prev.filter((pet) => String(pet.user_id) !== String(userId)),
    );
  }, []);

  const fetchMyPets = useCallback(async (): Promise<Pet[]> => {
    if (!token) return [];

    setIsLoading(true);

    try {
      const pets = await fetchMyPetsRequest(token);

      setMyPets(pets);
      await savePetsToCache(pets);

      return pets;
    } catch (error) {
      devError(
        "[PetsContext] fetchMyPets failed.",
        getApiErrorMessage(error, "Unable to load pets."),
      );
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchBrowsePets = useCallback(
    async (filters?: BrowseFilters): Promise<Pet[]> => {
      if (!token) return [];

      const petId = filters?.petId ?? myPetsRef.current[0]?.id;

      if (!petId) {
        setBrowsePets([]);
        setHasMore(false);
        setNextCursor(null);

        return [];
      }

      try {
        const result = await fetchBrowsePetsRequest(token, {
          petId,
          radius: filters?.radius,
          limit: filters?.limit,
          cursor: filters?.cursor,
        });

        const pets = result.pets;

        setBrowsePets((prev) => (filters?.append ? [...prev, ...pets] : pets));

        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);

        return pets;
      } catch (error) {
        devError(
          "[PetsContext] fetchBrowsePets failed.",
          getApiErrorMessage(error, "Unable to load browse pets."),
        );
        return [];
      }
    },
    [token],
  );

  const likePet = useCallback(
    async (
      fromPetId: string,
      toPetId: string,
    ): Promise<{ matched: boolean; match?: Match }> => {
      if (!token) return { matched: false };

      try {
        const result = await likePetRequest(token, { fromPetId, toPetId });

        const match = result.match;

        if (result.matched && match) {
          setMatches((prev) => {
            const exists = prev.some(
              (item) => String(item.id) === String(match.id),
            );

            if (exists) return prev;

            return sortMatchesByActivity([match, ...prev]);
          });

          return result;
        }

        return { matched: false };
      } catch (error) {
        devError(
          "[PetsContext] likePet failed.",
          getApiErrorMessage(error, "Unable to like pet."),
        );
        return { matched: false };
      }
    },
    [token, sortMatchesByActivity],
  );

  const dislikePet = useCallback(
    async (fromPetId: string, toPetId: string): Promise<void> => {
      if (!token) return;

      try {
        await dislikePetRequest(token, { fromPetId, toPetId });
      } catch (error) {
        devError(
          "[PetsContext] dislikePet failed.",
          getApiErrorMessage(error, "Unable to pass on pet."),
        );
      }
    },
    [token],
  );

  const fetchAdoptionConversations = useCallback(async () => {
    if (!token) return;

    try {
      const result = await getAdoptionConversations(token);
      setAdoptionConversations(sortAdoptionConversationsByActivity(result.items));
    } catch (error) {
      devError(
        "[PetsContext] fetchAdoptionConversations failed.",
        getApiErrorMessage(error, "Unable to load adoption chats."),
      );
    }
  }, [sortAdoptionConversationsByActivity, token]);

  const refreshAppCounts = useCallback(async () => {
    if (!token) return;

    try {
      const counts = await fetchAppCounts(token);
      setAppCounts(counts);
      markLiveDebugAppCountsRefresh();
    } catch (error) {
      devWarn(
        "[PetsContext] refreshAppCounts failed.",
        getApiErrorMessage(error, "Unable to refresh app counts."),
      );
    }
  }, [token]);

  const fetchMatches = useCallback(async () => {
    if (!token) return;

    try {
      const items = await fetchMatchesRequest(token);

      setMatches(sortMatchesByActivity(items));
    } catch (error) {
      devError(
        "[PetsContext] fetchMatches failed.",
        getApiErrorMessage(error, "Unable to load matches."),
      );
    }
  }, [token, sortMatchesByActivity]);

  const createPet = useCallback(
    async (data: FormData) => {
      if (!token) return null;

      try {
        const newPet = await createPetRequest(token, data);

        setMyPets((prev) => {
          const updated = [...prev, newPet];
          savePetsToCache(updated);
          return updated;
        });

        return newPet;
      } catch (error) {
        devWarn(
          "[PetsContext] Pet creation failed.",
          getApiErrorMessage(error, "Unable to create pet."),
        );
        return null;
      }
    },
    [token],
  );

  const updatePet = useCallback(
    async (id: string, data: FormData) => {
      if (!token) return null;

      try {
        const updatedPet = await updatePetRequest(token, id, data);

        setMyPets((prev) => {
          const updated = prev.map((p) =>
            String(p.id) === String(id) ? updatedPet : p,
          );

          savePetsToCache(updated);

          return updated;
        });

        return updatedPet;
      } catch (error) {
        devWarn(
          "[PetsContext] Pet update failed.",
          getApiErrorMessage(error, "Unable to update pet."),
        );
        return null;
      }
    },
    [token],
  );

  const deletePet = useCallback(
    async (id: string) => {
      if (!token) return false;

      try {
        await deletePetRequest(token, id);

        setMyPets((prev) => {
          const updated = prev.filter((p) => String(p.id) !== String(id));
          savePetsToCache(updated);
          return updated;
        });

        setBrowsePets([]);
        setHasMore(false);
        setNextCursor(null);

        return true;
      } catch (error) {
        devWarn(
          "[PetsContext] Pet deletion failed.",
          getApiErrorMessage(error, "Unable to delete pet."),
        );
        return false;
      }
    },
    [token],
  );

  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      setNotifications(await getNotificationsRequest(token));
    } catch (error) {
      devError(
        "[PetsContext] fetchNotifications failed.",
        getApiErrorMessage(error, "Unable to load notifications."),
      );
    }
  }, [token]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!token) return;

      try {
        await markNotificationReadRequest(token, id);

        setNotifications((prev) =>
          prev.map((item) =>
            String(item.id) === String(id)
              ? {
                ...item,
                is_read: true,
                read_at: new Date().toISOString(),
              }
              : item,
            ),
        );
      } catch (error) {
        devError(
          "[PetsContext] markNotificationRead failed.",
          getApiErrorMessage(error, "Unable to mark notification as read."),
        );
      }
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;

    try {
      await markAllNotificationsReadRequest(token);

      const now = new Date().toISOString();

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? now,
        })),
      );
    } catch (error) {
      devError(
        "[PetsContext] markAllRead failed.",
        getApiErrorMessage(error, "Unable to mark notifications as read."),
      );
    }
  }, [token]);

  const registerDeviceToken = useCallback(async () => {
    if (!token) return;

    if (registeringPushTokenRef.current) {
      return;
    }

    registeringPushTokenRef.current = true;

    try {
      const expoToken = await getExpoPushToken();

      devLog("[Push] Expo push token lookup completed.", {
        present: Boolean(expoToken),
      });

      if (!expoToken) return;

      const registrationKey = `${token}:${expoToken}`;

      if (registeredPushTokenRef.current === registrationKey) {
        return;
      }

      await registerDeviceTokenRequest(token, {
        token: expoToken,
        provider: "expo",
      });

      registeredPushTokenRef.current = registrationKey;
      setLiveDebugPushTokenRegistered(true);
      devLog("[Push] Device token registered.", {
        provider: "expo",
      });
    } catch (error) {
      devError(
        "[PetsContext] registerDeviceToken failed.",
        getApiErrorMessage(error, "Unable to register device token."),
      );
    } finally {
      registeringPushTokenRef.current = false;
    }
  }, [token]);

  const retryDeviceTokenRegistrationIfGranted = useCallback(async () => {
    if (!token) return;

    const permissionStatus = await getNotificationPermissionStatus();

    devLog("[Push] Notification permission status.", {
      status: permissionStatus,
    });
    setLiveDebugPushPermissionStatus(permissionStatus);

    if (permissionStatus !== "granted") {
      return;
    }

    const expoToken = await getExistingExpoPushToken();

    devLog("[Push] Existing Expo push token lookup completed.", {
      present: Boolean(expoToken),
    });

    if (!expoToken) {
      void registerDeviceToken();
      return;
    }

    if (registeredPushTokenRef.current === `${token}:${expoToken}`) {
      return;
    }

    void registerDeviceToken();
  }, [registerDeviceToken, token]);

  const refreshRealtimeConnection = useCallback(async () => {
    if (!shouldUsePetsRealtime()) {
      devWarn("[Realtime] realtime disabled", {
        action: "disabled",
      });
      return;
    }

    if (!token) {
      devWarn("[Realtime] missing token", {
        action: "missing_token",
      });
      return;
    }

    if (!user?.id) {
      devWarn("[Realtime] missing user id", {
        action: "missing_user_id",
      });
      return;
    }

    const connectionKey = `${token}:${user.id}`;

    if (
      realtimeDisconnectRef.current &&
      realtimeConnectionKeyRef.current === connectionKey
    ) {
      const pusherState = getRealtimePusherConnectionState();

      if (isSharedRealtimePusherConnectionUsable()) {
        devLog("[Realtime] user channel connection already active", {
          userId: user.id,
          action: "reuse",
          state: pusherState,
        });
        return;
      }

      devWarn("[Realtime] user channel connection stale", {
        userId: user.id,
        action: "restart",
        state: pusherState,
      });

      realtimeDisconnectRef.current();
      realtimeDisconnectRef.current = null;
      realtimeConnectionKeyRef.current = null;
    }

    if (realtimeDisconnectRef.current) {
      realtimeDisconnectRef.current();
      realtimeDisconnectRef.current = null;
      realtimeConnectionKeyRef.current = null;
    }

    try {
      devLog("[Realtime] user channel connection starting", {
        userId: user.id,
        action: "connect",
      });
      realtimeDisconnectRef.current = connectPetsRealtime({
        token,
        userId: user.id,

        onMessageSent: (payload) => {
          devLog("[Realtime] user channel message event received", {
            action: "received",
          });
          const message = extractRealtimeMessage(payload);

          if (!message) {
            devLog("[Realtime] normal message ignored", {
              reason: "payload_not_normalized",
              action: "ignored",
            });
            return;
          }

          if (!shouldProcessMessageEvent(message)) {
            devLog("[Realtime] normal message ignored", {
              message_id: message.id,
              conversation_id: message.conversation_id,
              action: "ignored",
            });
            return;
          }

          const activeConversationId = getActiveConversationId();
          const isActiveConversation =
            activeConversationId != null &&
            String(activeConversationId) === String(message.conversation_id);

          if (
            String(message.sender_id) === String(user.id) ||
            isActiveConversation
          ) {
            updateMatchLastMessage(message);

            if (isActiveConversation) {
              markConversationReadLocal(message.conversation_id);
            }

            devLog("[Realtime] normal message updated latest only", {
              message_id: message.id,
              conversation_id: message.conversation_id,
              active: isActiveConversation,
              own: String(message.sender_id) === String(user.id),
              action: "updated",
            });

            return;
          }

          incrementUnreadForConversation(message);
          devLog("[Realtime] normal message incremented unread", {
            message_id: message.id,
            conversation_id: message.conversation_id,
            action: "incremented_unread",
          });

          const matchedItem = matchesRef.current.find(
            (item) => String(item.conversation_id) === String(message.conversation_id),
          );

          const title =
            matchedItem?.matched_pet?.name ??
            matchedItem?.pet_two?.name ??
            matchedItem?.pet_one?.name ??
            "New message";

          emitInAppMessageBanner({
            conversationId: message.conversation_id,
            matchId: matchedItem?.id ?? null,
            title,
            body: message.body ?? "New message",
            match: matchedItem ?? null,
          });
        },

        onAdoptionMessageSent: (payload) => {
          devLog("[Realtime] user channel adoption message event received", {
            action: "received",
          });
          const message = extractRealtimeAdoptionMessage(payload);

          if (!message) {
            devLog("[Realtime] adoption message ignored", {
              reason: "payload_not_normalized",
              action: "ignored",
            });
            return;
          }

          if (!shouldProcessAdoptionMessageEvent(message)) {
            devLog("[Realtime] adoption message ignored", {
              message_id: message.id,
              adoption_conversation_id: message.adoption_conversation_id,
              action: "ignored",
            });
            return;
          }

          const activeAdoptionConversationId = getActiveAdoptionConversationId();
          const isActiveConversation =
            activeAdoptionConversationId != null &&
            String(activeAdoptionConversationId) ===
              String(message.adoption_conversation_id);

          if (
            String(message.sender_id) === String(user.id) ||
            isActiveConversation
          ) {
            updateAdoptionLastMessage(message);

            if (isActiveConversation) {
              markAdoptionConversationReadLocal(message.adoption_conversation_id);
            }

            devLog("[Realtime] adoption message updated latest only", {
              message_id: message.id,
              adoption_conversation_id: message.adoption_conversation_id,
              active: isActiveConversation,
              own: String(message.sender_id) === String(user.id),
              action: "updated",
            });

            return;
          }

          incrementAdoptionUnread(message);
          devLog("[Realtime] adoption message incremented unread", {
            message_id: message.id,
            adoption_conversation_id: message.adoption_conversation_id,
            action: "incremented_unread",
          });
        },

        onAdoptionCompleted: () => {
          void fetchMyPets();
          void fetchAdoptionConversations();
          void refreshAppCounts();
          void fetchNotifications();
        },

        onMatchCreated: (payload) => {
          const realtimeMatchId = extractRealtimeMatchId(payload);
          devLog("[Realtime] match event received", {
            match_id: realtimeMatchId,
            action: "received",
          });
          const event = payload && typeof payload === "object"
            ? payload as {
                notification?: Partial<Notification> & { id?: unknown };
                match?: Match;
              }
            : null;
          const notification = event?.notification;
          const realtimeMatch = event?.match
            ? normalizeMatchDocuments(event.match)
            : undefined;

          if (notification?.id && shouldProcessNotificationEvent(payload)) {
            setNotifications((prev) => {
              const exists = prev.some(
                (item) => String(item.id) === String(notification.id),
              );

              if (exists) return prev;

              return [
                {
                  ...notification,
                  is_read: notification.is_read ?? false,
                } as Notification,
                ...prev,
              ];
            });
          }

          if (realtimeMatch?.id) {
            setMatches((prev) => {
              const exists = prev.some(
                (item) => String(item.id) === String(realtimeMatch.id),
              );

              if (exists) return prev;

              return sortMatchesByActivity([realtimeMatch, ...prev]);
            });

            if (shouldEmitMatchPopup(payload)) {
              emitMatchPopup(payload as Parameters<typeof emitMatchPopup>[0]);
              devLog("[Realtime] match popup emitted", {
                match_id: realtimeMatch.id,
                action: "show_popup",
              });
            }
          }

          if (realtimeMatch?.id && shouldReconcileMatchEvent(payload)) {
            devLog("[Realtime] match list refresh requested", {
              match_id: realtimeMatch.id,
              action: "refreshed",
            });
            void fetchMatches();
          }

          if (!realtimeMatch?.id && realtimeMatchId) {
            const popupPayload = event ?? { match_id: realtimeMatchId };

            if (shouldEmitMatchPopup(payload)) {
              emitMatchPopup(popupPayload as Parameters<typeof emitMatchPopup>[0]);
              devLog("[Realtime] match popup emitted", {
                match_id: realtimeMatchId,
                action: "show_popup",
              });
            }

            if (shouldReconcileMatchEvent(payload)) {
              devLog("[Realtime] match list refresh requested", {
                match_id: realtimeMatchId,
                action: "refreshed",
              });
              void fetchMatches();
            }
          }
        },
      });
      realtimeConnectionKeyRef.current = connectionKey;
    } catch (error) {
      realtimeConnectionKeyRef.current = null;
      devError(
        "[PetsContext] refreshRealtimeConnection failed.",
        error instanceof Error ? error.message : "Realtime setup failed.",
      );
    }
  }, [
    token,
    user?.id,
    fetchMyPets,
    fetchMatches,
    fetchNotifications,
    fetchAdoptionConversations,
    refreshAppCounts,
    shouldProcessNotificationEvent,
    shouldProcessMessageEvent,
    shouldProcessAdoptionMessageEvent,
    shouldEmitMatchPopup,
    shouldReconcileMatchEvent,
    markConversationReadLocal,
    markAdoptionConversationReadLocal,
    updateMatchLastMessage,
    updateAdoptionLastMessage,
    incrementUnreadForConversation,
    incrementAdoptionUnread,
    sortMatchesByActivity,
  ]);

  useEffect(() => {
    if (!token) return;

    fetchMatches();
    fetchNotifications();
    fetchAdoptionConversations();
    refreshAppCounts();
    registerDeviceToken();
    setLiveDebugUserId(user?.id ?? null);
  }, [
    token,
    user?.id,
    fetchMatches,
    fetchNotifications,
    fetchAdoptionConversations,
    refreshAppCounts,
    registerDeviceToken,
  ]);

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    const retry = () => {
      if (!mounted) return;

      void retryDeviceTokenRegistrationIfGranted();
      void refreshAppCounts();
      void fetchAdoptionConversations();
      void refreshRealtimeConnection();
    };

    retry();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        retry();
      }
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [
    retryDeviceTokenRegistrationIfGranted,
    token,
    user?.id,
    refreshAppCounts,
    fetchAdoptionConversations,
    refreshRealtimeConnection,
  ]);

  useEffect(() => {
    if (!token || !user?.id) return;

    refreshRealtimeConnection();

    return () => {
      if (realtimeDisconnectRef.current) {
        realtimeDisconnectRef.current();
        realtimeDisconnectRef.current = null;
      }
      realtimeConnectionKeyRef.current = null;
    };
    // Keep the realtime socket scoped to the auth/user pair. Callback refs used
    // inside refreshRealtimeConnection should not recreate the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const chatUnreadCount =
    appCounts != null
      ? appCounts.unread_match_chats + appCounts.unread_adoption_chats
      : matches.reduce((total, match) => total + Number(match.unread_count ?? 0), 0) +
        adoptionConversations.reduce(
          (total, conversation) => total + Number(conversation.unread_count ?? 0),
          0,
        );

  return (
    <PetsContext.Provider
      value={{
        myPets,
        browsePets,
        matches,
        notifications,
        isLoading,
        hasMore,
        nextCursor,
        fetchMyPets,
        fetchBrowsePets,
        fetchMatches,
        fetchNotifications,
        createPet,
        updatePet,
        deletePet,
        likePet,
        dislikePet,
        markNotificationRead,
        markAllRead,
        registerDeviceToken,
        refreshRealtimeConnection,
        updateMatchLastMessage,
        incrementUnreadForConversation,
        markConversationReadLocal,
        removeMatchLocal,
        removeMatchesForUserLocal,
        removeBrowsePetsForUserLocal,
        adoptionConversations,
        fetchAdoptionConversations,
        updateAdoptionLastMessage,
        incrementAdoptionUnread,
        markAdoptionConversationReadLocal,
        appCounts,
        refreshAppCounts,
        chatUnreadCount,
        unreadCount,
      }}
    >
      {children}
    </PetsContext.Provider>
  );
}

export function usePets() {
  const ctx = useContext(PetsContext);

  if (!ctx) {
    throw new Error("usePets must be used within PetsProvider");
  }

  return ctx;
}
