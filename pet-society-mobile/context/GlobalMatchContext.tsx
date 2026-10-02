import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { MatchModal } from "@/components/MatchModal";
import { usePets, type Match, type Pet } from "@/context/PetsContext";
import {
    markMatchPopupRecentlyShown,
    subscribeMatchPopup,
    wasMatchPopupRecentlyShown,
} from "@/services/matchPopupBus";

type PetLike = Partial<Pet> & {
    pet_name?: string;
    pet_type?: string;
    images?: Array<{
        url?: string | null;
        image_path?: string | null;
    }>;
};

type QueuedPopup = {
    id: string;
    matchId: string | number | null;
    myPet: PetLike | null;
    matchedPet: PetLike | null;
};

type GlobalMatchContextValue = {
    showMatchPopup: (payload: {
        matchId?: string | number | null;
        myPet?: PetLike | null;
        matchedPet?: PetLike | null;
    }) => void;
};

const GlobalMatchContext = createContext<GlobalMatchContextValue | null>(null);

function extractMatchId(payload: any): string | number | null {
    return (
        payload?.match?.id ??
        payload?.match_id ??
        payload?.notification?.match_id ??
        payload?.notification?.data?.match_id ??
        payload?.data?.match_id ??
        null
    );
}

function extractMyPet(payload: any): PetLike | null {
    return (
        payload?.match?.my_pet ??
        payload?.my_pet ??
        payload?.data?.my_pet ??
        payload?.notification?.data?.my_pet ??
        null
    );
}

function extractMatchedPet(payload: any): PetLike | null {
    return (
        payload?.match?.matched_pet ??
        payload?.matched_pet ??
        payload?.data?.matched_pet ??
        payload?.notification?.data?.matched_pet ??
        null
    );
}

function buildPetFromNotificationData(
    payload: any,
    side: "my" | "matched",
): PetLike | null {
    const data = payload?.notification?.data ?? payload?.data ?? {};

    if (side === "my") {
        const id = data?.my_pet_id ?? null;
        const name = data?.my_pet_name ?? null;

        if (!id && !name) return null;

        return {
            id,
            name: name ?? "Your pet",
            image: null,
            type: "Pet",
            breed: "",
        } as PetLike;
    }

    const id = data?.matched_pet_id ?? null;
    const name = data?.matched_pet_name ?? null;

    if (!id && !name) return null;

    return {
        id,
        name: name ?? "Matched pet",
        image: null,
        type: "Pet",
        breed: "",
    } as PetLike;
}

function resolveMatchFromList(
    matches: Match[],
    matchId: string | number | null,
): Match | null {
    if (matchId == null) return null;

    return matches.find((match) => String(match.id) === String(matchId)) ?? null;
}

function myPetFromMatch(match: Match | null): PetLike | null {
    return (match?.my_pet ?? match?.pet_one ?? null) as PetLike | null;
}

function matchedPetFromMatch(match: Match | null): PetLike | null {
    return (match?.matched_pet ?? match?.pet_two ?? null) as PetLike | null;
}

export function GlobalMatchProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { matches, fetchMatches } = usePets();

    const [queue, setQueue] = useState<QueuedPopup[]>([]);
    const [activePopup, setActivePopup] = useState<QueuedPopup | null>(null);

    const matchesRef = useRef(matches);
    const activePopupRef = useRef<QueuedPopup | null>(null);

    useEffect(() => {
        matchesRef.current = matches;
    }, [matches]);

    useEffect(() => {
        activePopupRef.current = activePopup;
    }, [activePopup]);

    const enqueuePopup = useCallback((popup: QueuedPopup) => {
        setQueue((prev) => {
            const existsInQueue = prev.some(
                (item) =>
                    popup.matchId != null &&
                    item.matchId != null &&
                    String(item.matchId) === String(popup.matchId),
            );

            const isCurrentlyActive =
                activePopupRef.current?.matchId != null &&
                popup.matchId != null &&
                String(activePopupRef.current.matchId) === String(popup.matchId);

            if (existsInQueue || isCurrentlyActive) return prev;

            return [...prev, popup];
        });
    }, []);

    const showMatchPopup = useCallback(
        ({
            matchId = null,
            myPet = null,
            matchedPet = null,
        }: {
            matchId?: string | number | null;
            myPet?: PetLike | null;
            matchedPet?: PetLike | null;
        }) => {
            if (matchId != null && wasMatchPopupRecentlyShown(matchId)) {
                return;
            }

            if (matchId != null) {
                markMatchPopupRecentlyShown(matchId);
            }

            enqueuePopup({
                id: `${matchId ?? "manual"}-${Date.now()}`,
                matchId,
                myPet,
                matchedPet,
            });
        },
        [enqueuePopup],
    );

    useEffect(() => {
        const unsubscribe = subscribeMatchPopup(async (payload) => {
            const matchId = extractMatchId(payload);

            if (matchId != null && wasMatchPopupRecentlyShown(matchId)) {
                return;
            }

            let match = resolveMatchFromList(matchesRef.current, matchId);

            if (!match && matchId != null) {
                await fetchMatches();

                await new Promise((resolve) => setTimeout(resolve, 150));

                match = resolveMatchFromList(matchesRef.current, matchId);
            }

            const myPet =
                extractMyPet(payload) ??
                myPetFromMatch(match) ??
                buildPetFromNotificationData(payload, "my");

            const matchedPet =
                extractMatchedPet(payload) ??
                matchedPetFromMatch(match) ??
                buildPetFromNotificationData(payload, "matched");

            if (!myPet && !matchedPet) {
                return;
            }

            if (matchId != null) {
                markMatchPopupRecentlyShown(matchId);
            }

            enqueuePopup({
                id: `${matchId ?? "realtime"}-${Date.now()}`,
                matchId,
                myPet,
                matchedPet,
            });
        });

        return unsubscribe;
    }, [enqueuePopup, fetchMatches]);

    useEffect(() => {
        if (activePopup) return;
        if (queue.length === 0) return;

        const [next, ...rest] = queue;

        setActivePopup(next);
        setQueue(rest);
    }, [activePopup, queue]);

    const value = useMemo(
        () => ({
            showMatchPopup,
        }),
        [showMatchPopup],
    );

    return (
        <GlobalMatchContext.Provider value={value}>
            {children}

            <MatchModal
                visible={Boolean(activePopup)}
                myPet={(activePopup?.myPet as Pet) ?? null}
                matchedPet={(activePopup?.matchedPet as Pet) ?? null}
                onClose={() => {
                    setActivePopup(null);
                }}
            />
        </GlobalMatchContext.Provider>
    );
}

export function useGlobalMatch() {
    const ctx = useContext(GlobalMatchContext);

    if (!ctx) {
        throw new Error("useGlobalMatch must be used within GlobalMatchProvider");
    }

    return ctx;
}