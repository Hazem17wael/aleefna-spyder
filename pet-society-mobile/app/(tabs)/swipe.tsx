import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Reanimated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/useColors";
import { usePets, type Pet } from "@/context/PetsContext";
import { SwipeCard } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { ImageFallback } from "@/components/ImageFallback";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import { formatPetTypeWithEmoji, getPetTypeEmoji } from "@/constants/petTypes";
import { markMatchPopupRecentlyShown } from "@/services/matchPopupBus";
import { devError } from "@/utils/logger";

const LOAD_GUARD_MS = 12000;

function scrollBottomInset(insetsBottom: number) {
  const tabVisual =
    Platform.OS === "ios" ? 49 : Platform.OS === "android" ? 56 : 0;

  return Platform.OS === "web"
    ? 100
    : tabVisual + insetsBottom + (Platform.OS === "android" ? 28 : 20);
}

function SwipeSkeletonCard({
  height,
  width,
}: {
  height: number;
  width: number;
}) {
  const colors = useColors();
  const pulse = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <RNAnimated.View
      style={[
        styles.skeletonCard,
        {
          width,
          height,
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.58, 1],
          }),
        },
      ]}
    >
      <View
        style={[
          styles.skeletonPhoto,
          { backgroundColor: colors.secondary },
        ]}
      />
      <View style={styles.skeletonCopy}>
        <View
          style={[
            styles.skeletonLineWide,
            { backgroundColor: colors.secondary },
          ]}
        />
        <View
          style={[
            styles.skeletonLineShort,
            { backgroundColor: colors.secondary },
          ]}
        />
      </View>
    </RNAnimated.View>
  );
}

function safeImpact(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function appendUniquePets(current: Pet[], incoming: Pet[]) {
  const existing = new Set(current.map((p) => String(p.id)));

  const uniqueIncoming = incoming.filter((p) => {
    const id = String(p.id);

    if (existing.has(id)) {
      return false;
    }

    existing.add(id);
    return true;
  });

  return [...current, ...uniqueIncoming];
}

function StaticPetCard({
  pet,
  width,
  height,
  stackPosition,
  onViewDetails,
}: {
  pet: Pet;
  width: number;
  height: number;
  stackPosition: number;
  onViewDetails: () => void;
}) {
  const colors = useColors();

  const scale = 1 - stackPosition * 0.04;
  const translateY = stackPosition * 10;

  return (
    <View
      style={[
        styles.staticCard,
        {
          width,
          height,
          backgroundColor: colors.card,
          borderColor: `${colors.primary}33`,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      <ImageFallback
        uri={pet.image}
        containerStyle={styles.staticCardImage}
        fallbackStyle={[
          styles.staticCardImageFallback,
          { backgroundColor: colors.secondary },
        ]}
        fallback={<Text style={{ fontSize: 58 }}>{getPetTypeEmoji(pet.type)}</Text>}
        accessibilityLabel={`${pet.name} photo`}
      />

      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.82)"]}
        style={styles.staticCardGradient}
      />

      {stackPosition === 0 ? (
        <TouchableOpacity
          onPress={onViewDetails}
          activeOpacity={0.86}
          style={[
            styles.staticProfileBtn,
            {
              backgroundColor: `${colors.card}F2`,
              borderColor: `${colors.primary}38`,
            },
          ]}
        >
          <Feather name="user" size={13} color={colors.primary} />
          <Text style={[styles.staticProfileText, { color: colors.primary }]}>
            View profile
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.staticCardInfo}>
        <View style={styles.staticTypePill}>
          <Text style={styles.staticTypeText}>
            {formatPetTypeWithEmoji(pet.type)}
          </Text>
        </View>

        <View style={styles.staticCardNameRow}>
          <Text style={styles.staticCardName} numberOfLines={1}>
            {pet.name}
            {pet.age ? `, ${pet.age}` : ""}
          </Text>

          <PetVerifiedBadge pet={pet} compact />
        </View>

        <Text style={styles.staticCardMeta} numberOfLines={1}>
          {pet.breed} • {pet.gender}
          {pet.distance_km != null ? ` • ${pet.distance_km} km away` : ""}
        </Text>

        {!!pet.bio && (
          <Text style={styles.staticCardBio} numberOfLines={2}>
            {pet.bio}
          </Text>
        )}
      </View>
    </View>
  );
}

function SourcePetPanel({
  myPets,
  selectedPetId,
  myPet,
  onSelect,
}: {
  myPets: Pet[];
  selectedPetId: string | null;
  myPet: Pet | null;
  onSelect: (petId: string) => void;
}) {
  const colors = useColors();

  return (
    <Reanimated.View
      entering={FadeInDown.duration(280)}
      style={[
        styles.selectorBlock,
        {
          backgroundColor: colors.card,
          borderColor: `${colors.primary}28`,
        },
      ]}
    >
      <View style={styles.selectorTopRow}>
        <View>
          <Text style={[styles.selectorEyebrow, { color: colors.match }]}>
            SWIPING AS
          </Text>

          <Text
            style={[styles.selectorTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {myPet?.name ?? "Choose a pet"}
          </Text>
        </View>

        <View
          style={[
            styles.selectorAvatar,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <ImageFallback
            uri={myPet?.image}
            containerStyle={styles.selectorAvatarImg}
            fallback={
              <Text style={styles.selectorAvatarEmoji}>
                {getPetTypeEmoji(myPet?.type)}
              </Text>
            }
            accessibilityLabel={
              myPet?.name ? `${myPet.name} photo` : "Pet photo"
            }
          />
        </View>
      </View>

      {myPets.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          nestedScrollEnabled
          contentContainerStyle={styles.chipScrollContent}
        >
          {myPets.map((p) => {
            const on = selectedPetId === String(p.id);

            return (
              <TouchableOpacity
                key={String(p.id)}
                activeOpacity={0.9}
                onPress={() => onSelect(String(p.id))}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? colors.primary : colors.secondary,
                    borderColor: on ? colors.primary : `${colors.accent}40`,
                  },
                ]}
              >
                <Text style={styles.chipEmoji}>{getPetTypeEmoji(p.type)}</Text>

                <Text
                  style={[
                    styles.chipText,
                    {
                      color: on ? colors.primaryForeground : colors.foreground,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.singlePetPill,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={styles.chipEmoji}>{getPetTypeEmoji(myPet?.type)}</Text>

          <Text style={[styles.singlePetName, { color: colors.foreground }]}>
            {myPet?.breed || myPet?.type || "Ready to discover"}
          </Text>
        </View>
      )}
    </Reanimated.View>
  );
}

export default function SwipeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  const {
    myPets,
    fetchBrowsePets,
    fetchMyPets,
    likePet,
    dislikePet,
    hasMore,
    nextCursor,
  } = usePets();

  const CARD_H = Math.min(SCREEN_H * 0.5, 420);

  const [stack, setStack] = useState<Pet[]>([]);
  const [undoPet, setUndoPet] = useState<Pet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [matchedPet, setMatchedPet] = useState<Pet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSwipeActionRunning, setIsSwipeActionRunning] = useState(false);

  const initialLoadStarted = useRef(false);
  const lastLoadedPetId = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastRequestedCursorKey = useRef<string | null>(null);
  const pendingSwipeIds = useRef(new Set<string>());
  const selectedPetIdRef = useRef<string | null>(null);
  const isSwipeActionRunningRef = useRef(false);

  selectedPetIdRef.current = selectedPetId;

  const topPad = Platform.OS === "web" ? 52 : insets.top;
  const bottomPad = scrollBottomInset(insets.bottom);

  const topProgress = useSharedValue(0);
  const undoScale = useSharedValue(1);
  const dislikeScale = useSharedValue(1);
  const likeScale = useSharedValue(1);

  const cardW = Math.min(Math.max(SCREEN_W - 32, 288), 430);
  const cardH = CARD_H;

  const myPet = myPets.find((p) => String(p.id) === selectedPetId) ?? null;
  const visibleCards = stack.slice(-3);
  const actionDisabled =
    isSwipeActionRunning || isRefreshingFeed || stack.length === 0;
  const undoDisabled = !undoPet || isSwipeActionRunning || isRefreshingFeed;

  const feedSubtitle = useMemo(() => {
    if (loadError) return "Something went sideways";
    if (stack.length === 0) return "No pets in the stack";
    if (stack.length === 1) return "1 nearby pet waiting";
    return `${stack.length} nearby dogs and cats waiting`;
  }, [loadError, stack.length]);

  const undoAnim = useAnimatedStyle(() => ({
    transform: [{ scale: undoScale.value }],
  }));

  const dislikeAnim = useAnimatedStyle(() => ({
    transform: [{ scale: dislikeScale.value }],
  }));

  const likeAnim = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  function bump(sv: typeof likeScale) {
    sv.value = withSequence(
      withTiming(0.76, { duration: 70 }),
      withSpring(1.16, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 18 }),
    );
  }

  const loadFeedForPet = useCallback(
    async (petId: string, showLoader = false) => {
      if (!petId) return;

      if (showLoader) {
        setIsRefreshingFeed(true);
      }

      try {
        pendingSwipeIds.current.clear();
        setUndoPet(null);
        setStack([]);
        setLoadError(null);
        lastLoadedPetId.current = petId;
        lastRequestedCursorKey.current = null;

        const pets = await fetchBrowsePets({
          petId,
          radius: 500,
          limit: 20,
        });

        setStack(pets);
      } catch {
        devError("[SwipeScreen] feed load failed.");
        setStack([]);
        setLoadError("Could not load nearby dogs and cats. Please try again.");
      } finally {
        if (showLoader) {
          setIsRefreshingFeed(false);
        }
      }
    },
    [fetchBrowsePets],
  );

  const loadMorePets = useCallback(async () => {
    if (!selectedPetId) return;
    if (!hasMore) return;
    if (!nextCursor) return;
    if (isLoadingMoreRef.current) return;

    const cursorKey = `${nextCursor.distance}:${nextCursor.id}`;

    if (lastRequestedCursorKey.current === cursorKey) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastRequestedCursorKey.current = cursorKey;
    setIsLoadingMore(true);

    try {
      const morePets = await fetchBrowsePets({
        petId: selectedPetId,
        radius: 500,
        limit: 20,
        cursor: nextCursor,
        append: true,
      });

      if (morePets.length > 0) {
        setStack((prev) => appendUniquePets(prev, morePets));
      }
    } catch {
      devError("[SwipeScreen] load more failed.");
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [selectedPetId, hasMore, nextCursor, fetchBrowsePets]);

  useEffect(() => {
    if (initialLoadStarted.current) return;

    initialLoadStarted.current = true;

    let mounted = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const pets = await fetchMyPets();

        if (!mounted) return;

        const firstPet = pets[0];

        if (firstPet?.id) {
          const firstPetId = String(firstPet.id);

          setSelectedPetId(firstPetId);
          await loadFeedForPet(firstPetId);
        }
      } catch {
        devError("[SwipeScreen] initial load failed.");

        if (mounted) {
          setLoadError("Could not load swipe data. Please try again.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [fetchMyPets, loadFeedForPet]);

  useEffect(() => {
    if (!isLoading) return;

    const timeout = setTimeout(() => {
      setIsLoading(false);
      setLoadError("Loading took too long. Please try again.");
    }, LOAD_GUARD_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (selectedPetId) return;

    const firstPet = myPets[0];

    if (!firstPet?.id) return;

    const firstPetId = String(firstPet.id);

    setSelectedPetId(firstPetId);
    loadFeedForPet(firstPetId, true);
  }, [isLoading, selectedPetId, myPets, loadFeedForPet]);

  useEffect(() => {
    topProgress.value = 0;
  }, [stack.length, topProgress]);

  useEffect(() => {
    if (!selectedPetId) return;

    if (lastLoadedPetId.current === selectedPetId) {
      return;
    }

    loadFeedForPet(selectedPetId, true);
  }, [selectedPetId, loadFeedForPet]);

  function getSwipePet(petId?: string) {
    if (petId) {
      return stack.find((p) => String(p.id) === petId) ?? null;
    }

    return stack[stack.length - 1] ?? null;
  }

  async function handleLike(petId?: string) {
    const pet = getSwipePet(petId);
    const sourcePetId = selectedPetId;

    if (!pet || !sourcePetId) return;
    if (selectedPetIdRef.current !== sourcePetId) return;
    if (isSwipeActionRunningRef.current) return;

    const swipedPetId = String(pet.id);

    if (pendingSwipeIds.current.has(swipedPetId)) return;

    pendingSwipeIds.current.add(swipedPetId);
    isSwipeActionRunningRef.current = true;
    setIsSwipeActionRunning(true);
    bump(likeScale);
    safeImpact(Haptics.ImpactFeedbackStyle.Medium);

    setUndoPet(pet);
    setStack((prev) => prev.filter((item) => String(item.id) !== swipedPetId));

    const remainingCards = Math.max(stack.length - 1, 0);

    try {
      const res = await likePet(sourcePetId, swipedPetId);

      if (selectedPetIdRef.current !== sourcePetId) return;

      if (res.matched) {
        if (res.match?.id) {
          markMatchPopupRecentlyShown(res.match.id);
        }

        setMatchedPet(pet);
        setMatchModalVisible(true);
      }

      if (remainingCards <= 3) {
        loadMorePets();
      }
    } finally {
      pendingSwipeIds.current.delete(swipedPetId);
      isSwipeActionRunningRef.current = false;
      setIsSwipeActionRunning(false);
    }
  }

  async function handleDislike(petId?: string) {
    const pet = getSwipePet(petId);
    const sourcePetId = selectedPetId;

    if (!pet || !sourcePetId) return;
    if (selectedPetIdRef.current !== sourcePetId) return;
    if (isSwipeActionRunningRef.current) return;

    const swipedPetId = String(pet.id);

    if (pendingSwipeIds.current.has(swipedPetId)) return;

    pendingSwipeIds.current.add(swipedPetId);
    isSwipeActionRunningRef.current = true;
    setIsSwipeActionRunning(true);
    bump(dislikeScale);
    safeImpact(Haptics.ImpactFeedbackStyle.Light);

    setUndoPet(pet);
    setStack((prev) => prev.filter((item) => String(item.id) !== swipedPetId));

    const remainingCards = Math.max(stack.length - 1, 0);

    try {
      await dislikePet(sourcePetId, swipedPetId);

      if (selectedPetIdRef.current !== sourcePetId) return;

      if (remainingCards <= 3) {
        loadMorePets();
      }
    } finally {
      pendingSwipeIds.current.delete(swipedPetId);
      isSwipeActionRunningRef.current = false;
      setIsSwipeActionRunning(false);
    }
  }

  function handleUndo() {
    if (!undoPet || isSwipeActionRunningRef.current) return;

    bump(undoScale);
    safeImpact(Haptics.ImpactFeedbackStyle.Light);

    setStack((prev) => appendUniquePets(prev, [undoPet]));
    setUndoPet(null);
  }

  function handleSelectPet(petId: string) {
    if (petId === selectedPetId) return;

    setUndoPet(null);
    setStack([]);
    pendingSwipeIds.current.clear();
    lastLoadedPetId.current = null;
    lastRequestedCursorKey.current = null;
    setSelectedPetId(petId);
  }

  function handleRefresh() {
    if (!selectedPetId) return;
    if (isRefreshingFeed) return;

    setLoadError(null);
    lastLoadedPetId.current = null;
    lastRequestedCursorKey.current = null;
    loadFeedForPet(selectedPetId, true);
  }

  function openPetDetails(pet: Pet) {
    if (pet.id == null || pet.id === "") return;

    router.push({
      pathname: "/pets/[petId]" as any,
      params: {
        petId: String(pet.id),
        source: "swipe",
      },
    });
  }

  async function handleRetryInitialLoad() {
    if (isLoading) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const pets = await fetchMyPets();
      const firstPet = pets[0];

      if (firstPet?.id) {
        const firstPetId = String(firstPet.id);

        setSelectedPetId(firstPetId);
        await loadFeedForPet(firstPetId);
      }
    } catch {
      devError("[SwipeScreen] retry load failed.");
      setLoadError("Could not load swipe data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LinearGradient
          pointerEvents="none"
          colors={[colors.secondary, colors.background]}
          locations={[0, 0.65]}
          style={styles.screenTint}
        />

        <View style={styles.loadingCenter}>
          <SwipeSkeletonCard width={cardW} height={Math.min(cardH, 520)} />

          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Finding matches...
          </Text>

          <Text style={[styles.loadingSub, { color: colors.mutedForeground }]}>
            Loading pets near you
          </Text>
        </View>
      </View>
    );
  }

  if (myPets.length === 0) {
    return (
      <View
        style={[
          styles.screen,
          styles.center,
          {
            backgroundColor: colors.background,
            paddingBottom: scrollBottomInset(insets.bottom),
          },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[colors.secondary, colors.background]}
          locations={[0, 0.65]}
          style={styles.screenTint}
        />

        <Reanimated.View entering={FadeIn.springify()} style={styles.emptyWrap}>
          <View
            style={[
              styles.emptyIconBox,
              {
                backgroundColor: colors.primary + "14",
                borderColor: colors.primary + "28",
              },
            ]}
          >
            <Text style={{ fontSize: 58 }}>🐾</Text>
            <Text style={styles.emptySparkle}>✨</Text>
          </View>

          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {loadError ? "Could not load pets" : "No pets yet"}
          </Text>

          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {loadError ?? "Add your first pet to start matching."}
          </Text>

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={
              loadError
                ? handleRetryInitialLoad
                : () => router.push("/add-pet")
            }
            activeOpacity={0.88}
          >
            <Feather
              name={loadError ? "refresh-cw" : "plus"}
              size={18}
              color={colors.primaryForeground}
            />

            <Text
              style={[
                styles.ctaBtnText,
                { color: colors.primaryForeground },
              ]}
            >
              {loadError ? "Retry" : "Add pet"}
            </Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.secondary, colors.background]}
        locations={[0, 0.58]}
        style={styles.screenTint}
      />

      <View style={styles.decorLayer} pointerEvents="none">
        <View
          style={[
            styles.decorBlobOne,
            { backgroundColor: colors.primary + "12" },
          ]}
        />
        <View
          style={[
            styles.decorBlobTwo,
            { backgroundColor: colors.match + "12" },
          ]}
        />
        <Text style={[styles.decorPawOne, { color: colors.primary + "16" }]}>
          🐾
        </Text>
        <Text style={[styles.decorPawTwo, { color: colors.match + "16" }]}>
          🐾
        </Text>
      </View>

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          hitSlop={12}
          style={[
            styles.headerIconBtn,
            styles.headerIconCircle,
            {
              backgroundColor: colors.card,
              borderColor: `${colors.primary}40`,
            },
          ]}
          onPress={() => router.push("/(tabs)/my-pets")}
          accessibilityRole="button"
          accessibilityLabel="Your pets"
        >
          <Feather name="user" size={22} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerEyebrow, { color: colors.match }]}
            numberOfLines={1}
          >
            PET DISCOVERY
          </Text>

          <Text
            style={[styles.headerTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            Discover
          </Text>

          <Text
            style={[styles.headerSubtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {feedSubtitle}
          </Text>
        </View>

        <TouchableOpacity
          hitSlop={12}
          style={[
            styles.headerIconBtn,
            styles.headerIconCircle,
            {
              backgroundColor: colors.card,
              borderColor: `${colors.accent}40`,
              opacity: isRefreshingFeed ? 0.6 : 1,
            },
          ]}
          onPress={handleRefresh}
          disabled={isRefreshingFeed}
          accessibilityRole="button"
          accessibilityLabel="Refresh feed"
          activeOpacity={0.82}
        >
          <Feather name="refresh-cw" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        bounces={Platform.OS === "ios"}
        overScrollMode={Platform.OS === "android" ? "never" : undefined}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingFeed}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SourcePetPanel
          myPets={myPets}
          selectedPetId={selectedPetId}
          myPet={myPet}
          onSelect={handleSelectPet}
        />

        <View
          collapsable={false}
          style={[
            styles.cardArea,
            {
              height: cardH + 42,
              width: cardW,
              alignSelf: "center",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          {isRefreshingFeed ? (
            <View style={styles.refreshingCard}>
              <SwipeSkeletonCard width={cardW} height={cardH} />
              <Text
                style={[
                  styles.refreshingText,
                  { color: colors.mutedForeground },
                ]}
              >
                Refreshing the stack...
              </Text>
            </View>
          ) : stack.length === 0 ? (
            <Reanimated.View
              entering={FadeIn.springify()}
              style={[
                styles.emptyCard,
                Platform.OS === "android" ? styles.emptyCardAndroid : null,
                {
                  backgroundColor: colors.card,
                  borderColor: `${colors.primary}35`,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyCardIcon,
                  { backgroundColor: colors.primary + "14" },
                ]}
              >
                <Text style={{ fontSize: 44 }}>🐾</Text>
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.foreground,
                    fontSize: 20,
                    marginTop: 8,
                  },
                ]}
              >
                {loadError ? "Could not load pets" : "No dogs or cats nearby yet"}
              </Text>

              <Text
                style={[
                  styles.emptySub,
                  { color: colors.mutedForeground, fontSize: 13 },
                ]}
              >
                {loadError ?? "Pull to refresh or try again in a moment."}
              </Text>

              <TouchableOpacity
                onPress={handleRefresh}
                style={[styles.refreshBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.88}
              >
                <Feather
                  name="refresh-cw"
                  size={16}
                  color={colors.accentForeground}
                />

                <Text
                  style={[
                    styles.refreshText,
                    { color: colors.accentForeground },
                  ]}
                >
                  {loadError ? "Retry" : "Refresh"}
                </Text>
              </TouchableOpacity>
            </Reanimated.View>
          ) : Platform.OS === "web" ? (
            visibleCards.map((pet, i, arr) => (
              <StaticPetCard
                key={String(pet.id)}
                pet={pet}
                width={cardW}
                height={cardH}
                stackPosition={arr.length - 1 - i}
                onViewDetails={() => openPetDetails(pet)}
              />
            ))
          ) : (
            visibleCards.map((pet, i, arr) => (
              <SwipeCard
                key={String(pet.id)}
                pet={pet}
                stackPosition={arr.length - 1 - i}
                topProgress={topProgress}
                onLike={handleLike}
                onDislike={handleDislike}
                cardWidth={cardW}
                cardHeight={cardH}
                disabled={isSwipeActionRunning || isRefreshingFeed}
                onViewDetails={() => openPetDetails(pet)}
              />
            ))
          )}
        </View>

        {isLoadingMore && stack.length > 0 && (
          <View style={styles.loadingMoreWrap}>
            <ActivityIndicator size="small" color={colors.primary} />

            <Text
              style={[
                styles.loadingMoreText,
                { color: colors.mutedForeground },
              ]}
            >
              Loading more pets...
            </Text>
          </View>
        )}

        <Reanimated.View
          entering={FadeInDown.duration(280).delay(40)}
          style={[
            styles.actionBar,
            Platform.OS === "android" ? styles.actionBarAndroid : null,
          ]}
        >
          <Reanimated.View style={undoAnim}>
            <TouchableOpacity
              onPress={handleUndo}
              disabled={undoDisabled}
              activeOpacity={0.85}
              style={[
                styles.actionHit,
                {
                  opacity:
                    Platform.OS === "android" ? 1 : undoDisabled ? 0.35 : 1,
                },
              ]}
              accessibilityLabel="Undo"
            >
              <View
                style={[
                  styles.btnGhost,
                  Platform.OS === "android" ? styles.btnGhostAndroid : null,
                  {
                    borderColor:
                      Platform.OS === "android"
                        ? `${colors.warning}66`
                        : colors.warning,
                    backgroundColor:
                      Platform.OS === "android"
                        ? `${colors.warning}10`
                        : `${colors.warning}22`,
                    shadowColor:
                      Platform.OS === "android" ? colors.warning : undefined,
                  },
                ]}
              >
                <Feather name="rotate-ccw" size={22} color={colors.warning} />
              </View>
            </TouchableOpacity>
          </Reanimated.View>

          <Reanimated.View style={dislikeAnim}>
            <TouchableOpacity
              onPress={() => handleDislike()}
              disabled={actionDisabled}
              activeOpacity={0.9}
              style={[
                styles.actionHit,
                {
                  opacity:
                    Platform.OS === "android" ? 1 : actionDisabled ? 0.5 : 1,
                },
              ]}
              accessibilityLabel="Pass"
            >
              <View
                style={[
                  styles.btnMain,
                  Platform.OS === "android" ? styles.btnPassAndroid : null,
                  {
                    backgroundColor:
                      Platform.OS === "android"
                        ? `${colors.card}F5`
                        : `${colors.dislike}18`,
                    borderColor:
                      Platform.OS === "android"
                        ? `${colors.dislike}8A`
                        : colors.dislike,
                    shadowColor:
                      Platform.OS === "android" ? colors.dislike : undefined,
                  },
                ]}
              >
                <Feather name="x" size={32} color={colors.dislike} />
              </View>
            </TouchableOpacity>
          </Reanimated.View>

          <Reanimated.View style={likeAnim}>
            <TouchableOpacity
              onPress={() => handleLike()}
              disabled={actionDisabled}
              activeOpacity={0.9}
              style={[
                styles.actionHit,
                {
                  opacity:
                    Platform.OS === "android" ? 1 : actionDisabled ? 0.5 : 1,
                },
              ]}
              accessibilityLabel="Like"
            >
              <View
                style={[
                  styles.btnMain,
                  Platform.OS === "android" ? styles.btnLikeAndroid : null,
                  styles.btnMainShadowLike,
                  {
                    backgroundColor: colors.primary,
                    borderColor:
                      Platform.OS === "android"
                        ? `${colors.accent}99`
                        : colors.accent,
                  },
                ]}
              >
                <Feather
                  name="heart"
                  size={28}
                  color={colors.primaryForeground}
                />
              </View>
            </TouchableOpacity>
          </Reanimated.View>
        </Reanimated.View>

        <View style={styles.hintRow}>
          <View
            style={[
              styles.hintPill,
              Platform.OS === "android" ? styles.hintPillAndroid : null,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.hintEmoji}>👈</Text>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              pass
            </Text>
          </View>

          <View
            style={[
              styles.hintPill,
              Platform.OS === "android" ? styles.hintPillAndroid : null,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.hintEmoji}>👉</Text>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              like
            </Text>
          </View>
        </View>
      </ScrollView>

      <MatchModal
        visible={matchModalVisible}
        myPet={myPet}
        matchedPet={matchedPet}
        onClose={() => setMatchModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenTint: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorBlobOne: {
    position: "absolute",
    top: 130,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  decorBlobTwo: {
    position: "absolute",
    right: -100,
    bottom: 190,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  decorPawOne: {
    position: "absolute",
    top: 265,
    right: 26,
    fontSize: 36,
    transform: [{ rotate: "18deg" }],
  },
  decorPawTwo: {
    position: "absolute",
    bottom: 290,
    left: 24,
    fontSize: 30,
    transform: [{ rotate: "-15deg" }],
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  loadingSub: {
    fontSize: 14,
    fontWeight: "600",
  },

  header: {
    zIndex: 1,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 12,
  },
  headerIconBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconCircle: {
    borderRadius: 17,
    borderWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: -1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },

  selectorBlock: {
    marginHorizontal: 18,
    padding: 14,
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: 14,
    elevation: 2,
  },
  selectorTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectorEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  selectorTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  selectorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  selectorAvatarImg: {
    width: 46,
    height: 46,
  },
  selectorAvatarEmoji: {
    fontSize: 22,
  },
  chipScrollContent: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 160,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "800",
  },
  singlePetPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  singlePetName: {
    fontSize: 13,
    fontWeight: "800",
  },

  cardArea: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 14,
  },

  skeletonCard: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    justifyContent: "space-between",
  },
  skeletonPhoto: {
    flex: 1,
    borderRadius: 24,
  },
  skeletonCopy: {
    gap: 10,
    paddingTop: 16,
  },
  skeletonLineWide: {
    width: "62%",
    height: 18,
    borderRadius: 999,
  },
  skeletonLineShort: {
    width: "38%",
    height: 12,
    borderRadius: 999,
  },

  staticCard: {
    position: "absolute",
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
  },
  staticCardImage: {
    width: "100%",
    height: "100%",
  },
  staticCardImageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  staticCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  staticCardInfo: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
  },
  staticTypePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  staticTypeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  staticCardName: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  staticCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staticCardMeta: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  staticCardBio: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  staticProfileBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  staticProfileText: {
    fontSize: 12,
    fontWeight: "900",
  },

  refreshingCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  refreshingText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    width: "100%",
    height: "90%",
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 28,
  },
  emptyCardAndroid: {
    borderStyle: "solid",
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyCardIcon: {
    width: 88,
    height: 88,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
  },

  loadingMoreWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  loadingMoreText: {
    fontSize: 12,
    fontWeight: "600",
  },

  actionBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    paddingTop: 22,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  actionBarAndroid: {
    gap: 26,
    paddingTop: 18,
    paddingBottom: 6,
  },
  actionHit: {
    justifyContent: "center",
    alignItems: "center",
  },
  btnGhost: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnGhostAndroid: {
    width: 58,
    height: 58,
    borderRadius: 20,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  btnMain: {
    width: 66,
    height: 66,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      default: {},
    }),
  },
  btnPassAndroid: {
    width: 86,
    height: 86,
    borderRadius: 28,
    elevation: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  btnLikeAndroid: {
    width: 86,
    height: 86,
    borderRadius: 28,
    elevation: 4,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  btnMainShadowLike: Platform.select({
    ios: {
      shadowColor: "#ff6b6b",
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 4,
      shadowColor: "#ff6b6b",
    },
    default: {},
  }),

  hintRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  hintPillAndroid: {
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  hintEmoji: {
    fontSize: 13,
  },
  hintText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  emptyWrap: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyIconBox: {
    width: 116,
    height: 116,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    transform: [{ rotate: "-4deg" }],
  },
  emptySparkle: {
    position: "absolute",
    right: 19,
    bottom: 15,
    fontSize: 22,
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 4,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "900",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 12,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
