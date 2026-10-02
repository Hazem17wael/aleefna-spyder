import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import type { AdoptionApplication } from "@/types/adoption";
import { applicationListing } from "@/utils/adoption";

const STEPS = [
  { key: "applied", label: "Applied" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "accepted", label: "Accepted" },
  { key: "handover", label: "Handover" },
  { key: "completed", label: "Completed" },
];

function currentStep(application?: AdoptionApplication | null) {
  const status = String(application?.status ?? "");
  const listing = applicationListing(application);
  const handoverStarted = Boolean(
    listing?.owner_handover_confirmed_at ||
      listing?.adopter_handover_confirmed_at ||
      listing?.adopted_at ||
      application?.completed_at,
  );

  if (status === "completed" || application?.completed_at || listing?.adopted_at) {
    return 4;
  }

  if (handoverStarted) return 3;
  if (status === "accepted") return 2;
  if (status === "shortlisted") return 1;

  return 0;
}

function TimelineItem({
  complete,
  current,
  index,
  lineComplete,
  label,
}: {
  complete: boolean;
  current: boolean;
  index: number;
  lineComplete: boolean;
  label: string;
}) {
  const colors = useColors();
  const markerAnim = useRef(new Animated.Value(complete ? 1 : 0)).current;
  const lineAnim = useRef(new Animated.Value(lineComplete ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(markerAnim, {
      toValue: complete ? 1 : 0,
      delay: index * 55,
      damping: 15,
      stiffness: 250,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [complete, index, markerAnim]);

  useEffect(() => {
    Animated.timing(lineAnim, {
      toValue: lineComplete ? 1 : 0,
      delay: index * 55 + 40,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [index, lineAnim, lineComplete]);

  return (
    <View style={styles.item}>
      <View style={styles.markerColumn}>
        <Animated.View
          style={[
            styles.marker,
            {
              backgroundColor: complete ? colors.primary : colors.card,
              borderColor: complete ? colors.primary : colors.border,
              transform: [
                {
                  scale: markerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, current ? 1.1 : 1.03],
                  }),
                },
              ],
            },
          ]}
        >
          <Feather
            name={complete ? "check" : "circle"}
            size={13}
            color={complete ? colors.primaryForeground : colors.mutedForeground}
          />
        </Animated.View>
        {index < STEPS.length - 1 ? (
          <View style={[styles.lineTrack, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                styles.lineFill,
                {
                  backgroundColor: colors.primary,
                  opacity: lineAnim,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.label,
            { color: complete ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {label}
        </Text>
        {current ? (
          <Animated.Text
            style={[
              styles.current,
              {
                color: colors.primary,
                opacity: markerAnim,
              },
            ]}
          >
            Current status
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

export function ApplicationTimeline({
  application,
}: {
  application?: AdoptionApplication | null;
}) {
  const colors = useColors();
  const status = String(application?.status ?? "");
  const isStopped = status === "rejected" || status === "withdrawn";
  const activeIndex = currentStep(application);

  return (
    <View style={styles.wrap}>
      {STEPS.map((step, index) => {
        const complete = !isStopped && index <= activeIndex;
        const current = !isStopped && index === activeIndex;

        return (
          <TimelineItem
            key={step.key}
            complete={complete}
            current={current}
            index={index}
            label={step.label}
            lineComplete={!isStopped && index < activeIndex}
          />
        );
      })}

      {isStopped ? (
        <View
          style={[
            styles.stopped,
            { backgroundColor: colors.destructive + "12" },
          ]}
        >
          <Feather name="x-circle" size={15} color={colors.destructive} />
          <Text style={[styles.stoppedText, { color: colors.destructive }]}>
            Application {status}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  item: {
    flexDirection: "row",
    gap: 11,
    minHeight: 45,
  },
  markerColumn: {
    alignItems: "center",
  },
  marker: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lineTrack: {
    width: 2,
    flex: 1,
    minHeight: 18,
    overflow: "hidden",
  },
  lineFill: {
    ...StyleSheet.absoluteFillObject,
  },
  copy: {
    flex: 1,
    paddingTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "900",
  },
  current: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
  },
  stopped: {
    marginTop: 6,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  stoppedText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
});
