type MatchPopupPayload = {
    match?: any;
    notification?: any;
    my_pet?: any;
    matched_pet?: any;
    data?: any;
    match_id?: string | number | null;
    [key: string]: any;
};

type Listener = (payload: MatchPopupPayload) => void;

const listeners = new Set<Listener>();
const recentlyShown = new Map<string, number>();

const RECENT_TTL_MS = 15_000;

function cleanupRecentlyShown() {
    const now = Date.now();

    for (const [matchId, timestamp] of recentlyShown.entries()) {
        if (now - timestamp > RECENT_TTL_MS) {
            recentlyShown.delete(matchId);
        }
    }
}

export function subscribeMatchPopup(listener: Listener) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function emitMatchPopup(payload: MatchPopupPayload) {
    listeners.forEach((listener) => listener(payload));
}

export function markMatchPopupRecentlyShown(matchId?: string | number | null) {
    if (matchId == null) return;

    cleanupRecentlyShown();
    recentlyShown.set(String(matchId), Date.now());
}

export function wasMatchPopupRecentlyShown(matchId?: string | number | null) {
    if (matchId == null) return false;

    cleanupRecentlyShown();

    const timestamp = recentlyShown.get(String(matchId));

    if (!timestamp) return false;

    return Date.now() - timestamp <= RECENT_TTL_MS;
}