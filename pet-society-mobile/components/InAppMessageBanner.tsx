// components/InAppMessageBanner.tsx

import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
    subscribeInAppMessageBanner,
    type InAppMessagePayload,
} from "@/services/inAppMessageBus";

const HIDE_AFTER_MS = 4200;

export function InAppMessageBanner() {
    const colors = useColors();
    const insets = useSafeAreaInsets();

    const [payload, setPayload] = useState<InAppMessagePayload | null>(null);

    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function clearHideTimer() {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }

    function hide() {
        clearHideTimer();

        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setPayload(null);
        });
    }

    function show(nextPayload: InAppMessagePayload) {
        clearHideTimer();
        setPayload(nextPayload);

        translateY.setValue(-120);
        opacity.setValue(0);

        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                damping: 18,
                stiffness: 170,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();

        hideTimerRef.current = setTimeout(hide, HIDE_AFTER_MS);
    }

    useEffect(() => {
        const unsubscribe = subscribeInAppMessageBanner((nextPayload) => {
            show(nextPayload);
        });

        return () => {
            clearHideTimer();
            unsubscribe();
        };
    }, []);

    if (!payload) return null;

    const top = Platform.OS === "web" ? 14 : insets.top + 8;

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.wrap,
                {
                    top,
                    opacity,
                    transform: [{ translateY }],
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => {
                    hide();

                    router.push({
                        pathname: "/chat/[matchId]",
                        params: {
                            matchId: String(payload.matchId ?? payload.conversationId),
                            conversationId: String(payload.conversationId),
                        },
                    });
                }}
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View
                    style={[
                        styles.iconWrap,
                        {
                            backgroundColor: colors.primary + "16",
                        },
                    ]}
                >
                    <Text style={styles.icon}>🐾</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <Text
                            numberOfLines={1}
                            style={[styles.title, { color: colors.foreground }]}
                        >
                            {payload.title}
                        </Text>

                        <Text style={[styles.now, { color: colors.mutedForeground }]}>
                            now
                        </Text>
                    </View>

                    <Text
                        numberOfLines={1}
                        style={[styles.body, { color: colors.mutedForeground }]}
                    >
                        {payload.body || "New message"}
                    </Text>
                </View>

                <Feather name="chevron-right" size={18} color={colors.border} />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: "absolute",
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 9999,
    },

    card: {
        minHeight: 68,
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: Platform.OS === "ios" ? 0.12 : 0,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },

    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },

    icon: {
        fontSize: 22,
    },

    content: {
        flex: 1,
        minWidth: 0,
    },

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    title: {
        flex: 1,
        fontSize: 14.5,
        fontWeight: "900",
    },

    now: {
        fontSize: 11,
        fontWeight: "800",
    },

    body: {
        marginTop: 3,
        fontSize: 13,
        fontWeight: "600",
    },
});