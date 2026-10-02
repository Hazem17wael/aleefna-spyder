import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdoptionHeader,
  Card,
  ContactCard,
  EmptyState,
  LoadingState,
  Notice,
  ScreenShell,
  StatusBadge,
} from "@/components/adoption/AdoptionComponents";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  acceptApplication,
  createOrGetAdoptionConversation,
  getAdoptionErrorMessage,
  getListingApplications,
  rejectApplication,
  shortlistApplication,
} from "@/services/adoptionApi";
import type { AdoptionApplication } from "@/types/adoption";
import {
  asBool,
  formatDate,
  getApplicantAvatar,
  getApplicantName,
} from "@/utils/adoption";

function AnswerBlock({ label, value }: { label: string; value?: string | null }) {
  const colors = useColors();

  if (!value) return null;

  return (
    <View style={styles.answerBlock}>
      <Text style={[styles.answerLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.answerText, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function BooleanLine({ label, value }: { label: string; value: boolean }) {
  const colors = useColors();

  return (
    <View style={styles.booleanLine}>
      <Feather
        name={value ? "check-circle" : "circle"}
        size={16}
        color={value ? colors.success : colors.mutedForeground}
      />
      <Text style={[styles.booleanText, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function ApplicationCard({
  application,
  busy,
  onShortlist,
  onAccept,
  onReject,
  onMessage,
}: {
  application: AdoptionApplication;
  busy?: boolean;
  onShortlist: () => void;
  onAccept: () => void;
  onReject: () => void;
  onMessage: () => void;
}) {
  const colors = useColors();
  const avatar = getApplicantAvatar(application);
  const canShortlist = application.status === "pending";
  const canAccept = application.status === "pending" || application.status === "shortlisted";
  const canReject = application.status === "pending" || application.status === "shortlisted";
  const canMessage = ["accepted", "completed"].includes(String(application.status));

  const contact =
    application.applicant_contact ??
    (application.phone ? { phone: application.phone, name: application.applicant?.name } : null);

  return (
    <Card style={styles.applicationCard}>
      <View style={styles.applicantRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "16" }]}>
          {avatar ? (
            <Text style={[styles.avatarInitial, { color: colors.primary }]}>
              {getApplicantName(application).charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Feather name="user" size={18} color={colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.applicantName, { color: colors.foreground }]}>
            {getApplicantName(application)}
          </Text>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            Applied {formatDate(application.created_at) || "recently"}
          </Text>
        </View>
        <StatusBadge status={application.status} />
      </View>

      <AnswerBlock label="Message" value={application.message} />
      <AnswerBlock label="Experience" value={application.experience} />
      <AnswerBlock label="Home environment" value={application.home_environment} />

      <View style={styles.booleanGroup}>
        <BooleanLine label="Has other pets" value={asBool(application.has_other_pets)} />
        <BooleanLine label="Can afford care" value={asBool(application.can_afford_care)} />
      </View>

      {application.status === "accepted" ? (
        <>
          <Notice
            text="Accepted applicant. Coordinate a safe handover and confirm after the pet is handed over."
            tint={colors.success}
          />
          <ContactCard
            contact={contact}
            locked={application.contact_locked}
            title="Applicant Contact"
          />
        </>
      ) : null}

      <View style={styles.actions}>
        {canShortlist ? (
          <Button
            title="Shortlist"
            variant="secondary"
            onPress={onShortlist}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {canAccept ? (
          <Button
            title="Accept"
            onPress={onAccept}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {canReject ? (
          <Button
            title="Reject"
            variant="destructive"
            onPress={onReject}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {canMessage ? (
          <Button
            title="Message"
            variant="outline"
            leftIcon="message-circle"
            onPress={onMessage}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        <Button
          title="Report Application"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: "/reports/create",
              params: {
                reportable_type: "adoption_application",
                reportable_id: String(application.id),
                reported_user_id:
                  application.applicant?.id != null
                    ? String(application.applicant.id)
                    : undefined,
              },
            })
          }
        />
      </View>
    </Card>
  );
}

export default function OwnerApplicationsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AdoptionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 30;

  const load = useCallback(async () => {
    if (!token || !id) return;

    setError("");

    try {
      const result = await getListingApplications(token, id);
      setItems(result.items);
    } catch (err) {
      setError(getAdoptionErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
  }

  async function runAction(
    application: AdoptionApplication,
    action: "shortlist" | "accept" | "reject",
  ) {
    if (!token) return;

    const execute = async () => {
      setBusyId(String(application.id));

      try {
        if (action === "shortlist") {
          await shortlistApplication(token, application.id);
          Alert.alert("Application shortlisted.");
        }

        if (action === "accept") {
          await acceptApplication(token, application.id);
          Alert.alert("Application accepted. Contact details are now available.");
        }

        if (action === "reject") {
          await rejectApplication(token, application.id);
          Alert.alert("Application rejected.");
        }

        await load();
      } catch (err) {
        Alert.alert("Could not update application", getAdoptionErrorMessage(err));
      } finally {
        setBusyId(null);
      }
    };

    if (action === "accept") {
      Alert.alert(
        "Accept this applicant? Other pending applications may be rejected.",
        undefined,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Accept", onPress: execute },
        ],
      );
      return;
    }

    if (action === "reject") {
      Alert.alert("Reject this application?", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Reject", style: "destructive", onPress: execute },
      ]);
      return;
    }

    await execute();
  }

  async function openAdoptionChat(application: AdoptionApplication) {
    if (!token || !id) return;

    const existingConversationId = application.adoption_conversation?.id;

    if (existingConversationId) {
      router.push({
        pathname: "/adoption-chat/[conversationId]",
        params: { conversationId: String(existingConversationId) },
      });
      return;
    }

    setBusyId(String(application.id));

    try {
      const conversation = await createOrGetAdoptionConversation(token, {
        adoption_listing_id: id,
        adoption_application_id: application.id,
      });

      router.push({
        pathname: "/adoption-chat/[conversationId]",
        params: { conversationId: String(conversation.id) },
      });
    } catch (err) {
      Alert.alert("Could not open adoption chat", getAdoptionErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Applications" />
        <LoadingState label="Loading applications..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <AdoptionHeader
              title="Applications"
              subtitle="Review applicants and coordinate accepted handovers."
            />
            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <ApplicationCard
            application={item}
            busy={busyId === String(item.id)}
            onShortlist={() => runAction(item, "shortlist")}
            onAccept={() => runAction(item, "accept")}
            onReject={() => runAction(item, "reject")}
            onMessage={() => openAdoptionChat(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No applications yet" subtitle="Applications will appear here." />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          items.length === 0 ? styles.emptyList : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
    paddingHorizontal: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  applicationCard: {
    gap: 13,
  },
  applicantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: "900",
  },
  applicantName: {
    fontSize: 17,
    fontWeight: "900",
  },
  dateText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  answerBlock: {
    gap: 4,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  answerText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  booleanGroup: {
    gap: 8,
  },
  booleanLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  booleanText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actions: {
    gap: 9,
  },
  errorText: {
    paddingHorizontal: 18,
    fontSize: 13,
    fontWeight: "800",
  },
});
