import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  VALIDATION_ERROR_MESSAGE,
  firstValidationMessage,
  friendlyErrorMessage,
} from "@/utils/userMessages";

type FieldErrors = {
  name?: string;
  phone?: string;
};

function initialsFor(name?: string | null) {
  return (name || "P")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function backendFieldErrors(errors: any): FieldErrors {
  if (!errors || typeof errors !== "object") return {};

  return {
    name: Array.isArray(errors.name)
      ? friendlyErrorMessage(errors.name[0], VALIDATION_ERROR_MESSAGE)
      : undefined,
    phone: Array.isArray(errors.phone)
      ? friendlyErrorMessage(errors.phone[0], VALIDATION_ERROR_MESSAGE)
      : undefined,
  };
}

const EGYPT_PHONE_PATTERN = /^(?:\+20|0)?1[0-9]{9}$/;

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [originalName, setOriginalName] = useState(user?.name ?? "");
  const [originalPhone, setOriginalPhone] = useState(user?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState("");
  const dirtyAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 52 : insets.top;
  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;

  useEffect(() => {
    const nextName = user?.name ?? "";
    const nextPhone = user?.phone ?? "";

    setName(nextName);
    setPhone(nextPhone);
    setOriginalName(nextName);
    setOriginalPhone(nextPhone);
  }, [user?.id, user?.name, user?.phone]);

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const originalTrimmedName = originalName.trim();
  const originalTrimmedPhone = originalPhone.trim();
  const isDirty =
    trimmedName !== originalTrimmedName || trimmedPhone !== originalTrimmedPhone;
  const initials = useMemo(() => initialsFor(user?.name), [user?.name]);

  useEffect(() => {
    Animated.spring(dirtyAnim, {
      toValue: isDirty ? 1 : 0,
      damping: 16,
      stiffness: 240,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [dirtyAnim, isDirty]);

  useEffect(() => {
    Animated.timing(feedbackAnim, {
      toValue: formError || success ? 1 : 0,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [feedbackAnim, formError, success]);

  function clearFeedback(field?: keyof FieldErrors) {
    setFormError("");
    setSuccess("");
    if (field) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate() {
    const next: FieldErrors = {};

    if (!trimmedName) {
      next.name = "Name is required.";
    }

    if (trimmedPhone && !EGYPT_PHONE_PATTERN.test(trimmedPhone)) {
      next.phone = "Enter a valid Egyptian phone number.";
    }

    setFieldErrors(next);

    if (Object.keys(next).length > 0) {
      setFormError(VALIDATION_ERROR_MESSAGE);
      return false;
    }

    return true;
  }

  async function saveProfile() {
    if (submitting || !isDirty) return;
    if (!validate()) return;

    const payload: { name?: string; phone?: string | null } = {};

    if (trimmedName !== originalTrimmedName) {
      payload.name = trimmedName;
    }

    if (trimmedPhone !== originalTrimmedPhone) {
      payload.phone = trimmedPhone || null;
    }

    if (Object.keys(payload).length === 0) {
      setSuccess("Profile is already up to date.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setSuccess("");

    try {
      const result = await updateProfile(payload);

      if (!result.success) {
        const validationMessage = firstValidationMessage(result.errors);

        setFieldErrors(backendFieldErrors(result.errors));
        setFormError(
          validationMessage ||
            friendlyErrorMessage(
              result.message,
              "We could not update your profile. Please try again.",
            ),
        );
        return;
      }

      setOriginalName(trimmedName);
      setOriginalPhone(trimmedPhone);
      setSuccess("Profile updated successfully.");
      await refreshUser();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.84}
            style={[
              styles.iconButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>PROFILE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Edit Profile
            </Text>
          </View>

          <View style={styles.iconButtonSpacer} />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.identity}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + "16" },
              ]}
            >
              {user?.profile_image ? (
                <Image source={{ uri: user.profile_image }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {initials}
                </Text>
              )}
            </View>

            <View style={styles.identityCopy}>
              <Text
                style={[styles.identityName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {user?.name || "Aleefna member"}
              </Text>
              <Text
                style={[styles.identityEmail, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {user?.email || "Email unavailable"}
              </Text>
            </View>
          </View>

          <View style={[styles.readOnlyRow, { borderColor: colors.border }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.readOnlyLabel, { color: colors.mutedForeground }]}>
                Email
              </Text>
              <Text
                style={[styles.readOnlyValue, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {user?.email || "-"}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Input
            label="Name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              clearFeedback("name");
            }}
            placeholder="Your name"
            autoCapitalize="words"
            leftIcon="user"
            error={fieldErrors.name}
            editable={!submitting}
          />

          <Input
            label="Phone (optional)"
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              clearFeedback("phone");
            }}
            placeholder="01XXXXXXXXX"
            keyboardType="phone-pad"
            leftIcon="phone"
            error={fieldErrors.phone}
            editable={!submitting}
          />

          {formError ? (
            <Animated.View
              style={[
                styles.messageBox,
                {
                  backgroundColor: colors.destructive + "14",
                  opacity: feedbackAnim,
                  transform: [
                    {
                      translateY: feedbackAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.messageText, { color: colors.destructive }]}>
                {formError}
              </Text>
            </Animated.View>
          ) : null}

          {success ? (
            <Animated.View
              style={[
                styles.messageBox,
                {
                  backgroundColor: colors.success + "14",
                  opacity: feedbackAnim,
                  transform: [
                    {
                      translateY: feedbackAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.messageText, { color: colors.success }]}>
                {success}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View
            style={{
              opacity: dirtyAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.86, 1],
              }),
              transform: [
                {
                  scale: dirtyAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.995, 1],
                  }),
                },
              ],
            }}
          >
            <Button
              title="Save Changes"
              onPress={saveProfile}
              loading={submitting}
              disabled={submitting || !isDirty}
            />
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSpacer: {
    width: 42,
    height: 42,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "900",
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontSize: 19,
    fontWeight: "900",
  },
  identityEmail: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  readOnlyRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  readOnlyLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  readOnlyValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "700",
  },
  messageBox: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
});
