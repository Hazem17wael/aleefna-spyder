import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  Animated,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/hooks/useColors";
import { usePets } from "@/context/PetsContext";
import { PdfPickerField } from "@/components/forms/PdfPickerField";
import {
  SUPPORTED_PET_TYPES,
  getPetTypeOption,
  normalizePetTypeValue,
  toApiPetType,
} from "@/constants/petTypes";
import {
  getBreedOptionsForType,
  isBreedForPetType,
} from "@/constants/petBreeds";
import type { PickedPdf } from "@/utils/pickPdfFile";
import { getPetDocumentStatus } from "@/utils/petDocuments";
import {
  resolveOriginalPetName,
  resolveOriginalPetType,
  resolvePetImage,
} from "@/utils/pet";
import {
  VALIDATION_ERROR_MESSAGE,
  friendlyErrorMessage,
} from "@/utils/userMessages";
import {
  explainCameraPermission,
  explainPhotoLibraryPermission,
} from "@/utils/permissions";
import {
  LOCATION_PERMISSION_REQUIRED_MESSAGE,
  getCurrentCoordinatesFromUserAction,
} from "@/services/locationService";

const GENDERS = [
  { label: "Male", emoji: "♂", color: "#0984e3" },
  { label: "Female", emoji: "♀", color: "#e84393" },
];

const WIZARD_STEPS = [
  "Basic info",
  "Photo + location",
  "Trust documents",
  "Review",
];

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_UPLOAD_IMAGE_TYPE = "image/jpeg";
const IMAGE_PICKER_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

type UploadPhoto = {
  uri: string;
  name: string;
  type: string;
};

type FieldErrors = {
  photo?: string;
  petName?: string;
  petType?: string;
  breed?: string;
  age?: string;
  location?: string;
  bio?: string;
};

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function safeNotify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === "web") return;

  Haptics.notificationAsync(type).catch(() => { });
}

function showSettingsPrompt(title: string, message: string) {
  if (Platform.OS === "web") return;

  Alert.alert(title, message, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

function hasPhotoAccess(permission: ImagePicker.MediaLibraryPermissionResponse) {
  return (
    permission.status === "granted" ||
    permission.accessPrivileges === "limited"
  );
}

async function ensurePhotoLibraryPermission() {
  if (Platform.OS === "web") return true;

  const current = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (hasPhotoAccess(current)) return true;

  if (!current.canAskAgain) {
    showSettingsPrompt(
      "Photo access disabled",
      "Enable photo access in settings to choose a pet photo.",
    );
    return false;
  }

  const shouldAsk = await explainPhotoLibraryPermission();

  if (!shouldAsk) return false;

  const next = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (hasPhotoAccess(next)) return true;

  if (!next.canAskAgain) {
    showSettingsPrompt(
      "Photo access disabled",
      "Enable photo access in settings to choose a pet photo.",
    );
  } else {
    Alert.alert("Permission needed", "Allow photo access to choose a pet photo.");
  }

  return false;
}

async function ensureCameraPermission() {
  if (Platform.OS === "web") return true;

  const current = await ImagePicker.getCameraPermissionsAsync();

  if (current.status === "granted") return true;

  if (!current.canAskAgain) {
    showSettingsPrompt(
      "Camera access disabled",
      "Enable camera access in settings to take a pet photo.",
    );
    return false;
  }

  const shouldAsk = await explainCameraPermission();

  if (!shouldAsk) return false;

  const next = await ImagePicker.requestCameraPermissionsAsync();

  if (next.status === "granted") return true;

  if (!next.canAskAgain) {
    showSettingsPrompt(
      "Camera access disabled",
      "Enable camera access in settings to take a pet photo.",
    );
  } else {
    Alert.alert("Permission needed", "Allow camera access to take a pet photo.");
  }

  return false;
}

function normalizeGender(value?: string | null) {
  if (!value) return "Male";

  return value.toLowerCase() === "female" ? "Female" : "Male";
}

function getProfileProgress({
  petName,
  breed,
  age,
  bio,
  photo,
  latitude,
  longitude,
}: {
  petName: string;
  breed: string;
  age: string;
  bio: string;
  photo: string;
  latitude: number | null;
  longitude: number | null;
}) {
  let score = 0;

  if (photo) score += 25;
  if (petName.trim()) score += 15;
  if (breed.trim()) score += 15;
  if (age.trim()) score += 10;
  if (bio.trim()) score += 20;
  if (latitude !== null && longitude !== null) score += 15;

  return Math.min(score, 100);
}

function normalizeImageMimeType(mimeType?: string | null) {
  const normalized = mimeType?.trim().toLowerCase();

  if (
    normalized === "image/jpeg" ||
    normalized === "image/jpg" ||
    normalized === "image/png" ||
    normalized === "image/webp"
  ) {
    return normalized === "image/jpg" ? "image/jpeg" : normalized;
  }

  return DEFAULT_UPLOAD_IMAGE_TYPE;
}

function extensionForImageType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";

  return "jpg";
}

function uploadPhotoName(fileName?: string | null, type = DEFAULT_UPLOAD_IMAGE_TYPE) {
  const base = fileName?.trim().replace(/\.[^.]+$/, "");

  return `${base || "pet-photo"}.${extensionForImageType(type)}`;
}

function normalizeUploadPhoto(asset: ImagePicker.ImagePickerAsset): UploadPhoto {
  const type = normalizeImageMimeType(asset.mimeType);

  return {
    uri: asset.uri,
    name: uploadPhotoName(asset.fileName, type),
    type,
  };
}

export default function AddPetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, adoptionMode, returnTo } = useLocalSearchParams<{
    id?: string;
    adoptionMode?: string;
    returnTo?: string;
  }>();
  const { createPet, updatePet, myPets } = usePets();

  const editingPet = id
    ? myPets.find((p) => String(p.id) === String(id))
    : null;

  const initialPhoto = editingPet ? resolvePetImage(editingPet) ?? "" : "";

  const [petName, setPetName] = useState(resolveOriginalPetName(editingPet));
  const [petType, setPetType] = useState(
    resolveOriginalPetType(editingPet) ?? "Dog",
  );
  const [breed, setBreed] = useState(editingPet?.breed ?? "");
  const [age, setAge] = useState(editingPet?.age?.toString() ?? "");
  const [gender, setGender] = useState(normalizeGender(editingPet?.gender));
  const [bio, setBio] = useState(editingPet?.bio ?? "");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(
    editingPet?.latitude ?? null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    editingPet?.longitude ?? null,
  );
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [photo, setPhoto] = useState<string>(initialPhoto);
  const [photoUpload, setPhotoUpload] = useState<UploadPhoto | null>(null);
  const [medicalRecordPdf, setMedicalRecordPdf] = useState<PickedPdf | null>(
    null,
  );
  const [vaccinationPdf, setVaccinationPdf] = useState<PickedPdf | null>(
    null,
  );
  const [idDocumentPdf, setIdDocumentPdf] = useState<PickedPdf | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [bioFocused, setBioFocused] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [breedPickerVisible, setBreedPickerVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(26)).current;
  const stepAnim = useRef(new Animated.Value(1)).current;
  const photoReadyAnim = useRef(new Animated.Value(photo ? 1 : 0)).current;
  const locationReadyAnim = useRef(
    new Animated.Value(latitude !== null && longitude !== null ? 1 : 0),
  ).current;

  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const footerPad = Platform.OS === "web" ? 20 : Math.max(insets.bottom, 12);
  const bottomPad = footerPad + 118;

  const normalizedPetType = normalizePetTypeValue(petType);
  const typeMeta = getPetTypeOption(petType);
  const editingDocumentStatus = editingPet
    ? getPetDocumentStatus(editingPet)
    : null;
  const originalBreed = editingPet?.breed?.trim() ?? "";
  const originalType = normalizePetTypeValue(resolveOriginalPetType(editingPet));
  const legacyBreedForOptions =
    originalBreed &&
    normalizedPetType === originalType &&
    !isBreedForPetType(originalBreed, normalizedPetType)
      ? originalBreed
      : null;
  const breedOptions = useMemo(
    () => getBreedOptionsForType(normalizedPetType, legacyBreedForOptions),
    [legacyBreedForOptions, normalizedPetType],
  );

  const profileProgress = useMemo(
    () =>
      getProfileProgress({
        petName,
        breed,
        age,
        bio,
        photo,
        latitude,
        longitude,
      }),
    [age, bio, breed, latitude, longitude, petName, photo],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [currentStep, stepAnim]);

  useEffect(() => {
    Animated.spring(photoReadyAnim, {
      toValue: photo ? 1 : 0,
      damping: 15,
      stiffness: 250,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [photo, photoReadyAnim]);

  useEffect(() => {
    Animated.spring(locationReadyAnim, {
      toValue: latitude !== null && longitude !== null ? 1 : 0,
      damping: 15,
      stiffness: 250,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [latitude, locationReadyAnim, longitude]);

  useEffect(() => {
    if (!editingPet) return;

    setPetName(resolveOriginalPetName(editingPet));
    setPetType(resolveOriginalPetType(editingPet) ?? "Dog");
    setBreed(editingPet.breed ?? "");
    setAge(editingPet.age?.toString() ?? "");
    setGender(normalizeGender(editingPet.gender));
    setBio(editingPet.bio ?? "");
    setPhoto(resolvePetImage(editingPet) ?? "");
    setPhotoUpload(null);
    setLatitude(editingPet.latitude ?? null);
    setLongitude(editingPet.longitude ?? null);
    setMedicalRecordPdf(null);
    setVaccinationPdf(null);
    setIdDocumentPdf(null);
  }, [editingPet]);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError("");
  }

  function canKeepCurrentLegacyBreed(
    value: string,
    type: string | null = normalizedPetType,
  ) {
    const breedValue = value.trim();

    return Boolean(
      editingPet &&
        originalBreed &&
        breedValue === originalBreed &&
        type === originalType &&
        !isBreedForPetType(breedValue, type),
    );
  }

  async function pickPhoto() {
    if (loading) return;

    const hasPermission = await ensurePhotoLibraryPermission();

    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
      allowsMultipleSelection: false,
      allowsEditing: true,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 0.85,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
        const message = "Photo must be 8MB or less.";

        setFieldErrors((prev) => ({ ...prev, photo: message }));
        setError(message);
        safeNotify(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const upload = normalizeUploadPhoto(asset);

      setPhoto(upload.uri);
      setPhotoUpload(upload);
      clearFieldError("photo");
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function takePhoto() {
    if (loading) return;

    const hasPermission = await ensureCameraPermission();

    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
      allowsEditing: true,
      quality: 0.85,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
        const message = "Photo must be 8MB or less.";

        setFieldErrors((prev) => ({ ...prev, photo: message }));
        setError(message);
        safeNotify(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const upload = normalizeUploadPhoto(asset);

      setPhoto(upload.uri);
      setPhotoUpload(upload);
      clearFieldError("photo");
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function showPhotoOptions() {
    if (loading) return;

    if (Platform.OS === "web") {
      pickPhoto();
      return;
    }

    Alert.alert("Choose Photo", "Select a source", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Photo Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function detectLocation() {
    if (locationLoading || loading) return;

    setLocationLoading(true);
    setLocationError("");
    clearFieldError("location");

    try {
      const result = await getCurrentCoordinatesFromUserAction();

      if (!result.coords) {
        const message = result.message ?? LOCATION_PERMISSION_REQUIRED_MESSAGE;
        setLocationError(message);
        setFieldErrors((prev) => ({ ...prev, location: message }));
        return;
      }

      const { latitude: lat, longitude: lng } = result.coords;

      setLatitude(lat);
      setLongitude(lng);

      let detected = "";

      if (Platform.OS !== "web") {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (place) {
          const city = place.city || place.subregion || place.region || "";
          detected = [city, place.country].filter(Boolean).join(", ");
        }
      } else {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "en" } },
        );

        const json = await res.json();
        const addr = json?.address ?? {};
        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.county ||
          addr.state ||
          "";

        detected = [city, addr.country].filter(Boolean).join(", ");
      }

      setLocation(detected || "Location detected");
      clearFieldError("location");
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      const message = "Could not detect location. Please try again.";

      setLocationError(message);
      setFieldErrors((prev) => ({ ...prev, location: message }));
    } finally {
      setLocationLoading(false);
    }
  }

  function buildValidationErrors() {
    const nextErrors: FieldErrors = {};
    const parsedAge = Number(age);

    if (!photo) {
      nextErrors.photo = "Please add a pet photo.";
    }

    if (!petName.trim()) {
      nextErrors.petName = "Name is required.";
    }

    if (!normalizePetTypeValue(petType)) {
      nextErrors.petType = editingPet
        ? "This pet type is no longer supported. Please choose Dog or Cat before saving."
        : "Please choose Dog or Cat.";
    }

    if (!breed.trim()) {
      nextErrors.breed = "Please select a breed.";
    } else if (
      normalizedPetType &&
      !isBreedForPetType(breed, normalizedPetType) &&
      !canKeepCurrentLegacyBreed(breed, normalizedPetType)
    ) {
      nextErrors.breed = "Please select a breed.";
    }

    if (!age.trim() || !Number.isFinite(parsedAge) || parsedAge <= 0) {
      nextErrors.age = "Enter a valid age.";
    }

    if (latitude === null || longitude === null) {
      nextErrors.location = "Location is required.";
    }

    if (!bio.trim()) {
      nextErrors.bio = "Bio is required.";
    }

    return nextErrors;
  }

  function validate() {
    const nextErrors = buildValidationErrors();

    setFieldErrors(nextErrors);

    return nextErrors;
  }

  function validateStep(step: number) {
    const allErrors = buildValidationErrors();
    const stepFields: Array<keyof FieldErrors> =
      step === 0
        ? ["petName", "petType", "breed", "age"]
        : step === 1
          ? ["photo", "location", "bio"]
          : [];
    const stepErrors = stepFields.reduce<FieldErrors>((acc, field) => {
      if (allErrors[field]) acc[field] = allErrors[field];

      return acc;
    }, {});

    setFieldErrors((prev) => ({ ...prev, ...stepErrors }));

    if (Object.keys(stepErrors).length > 0) {
      setError(VALIDATION_ERROR_MESSAGE);
      safeNotify(Haptics.NotificationFeedbackType.Error);
      return false;
    }

    setError("");
    return true;
  }

  function goToNextStep() {
    if (currentStep < WIZARD_STEPS.length - 1) {
      if (!validateStep(currentStep)) return;

      setCurrentStep((step) => step + 1);
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    handleSave();
  }

  function goToPreviousStep() {
    if (currentStep === 0) {
      router.back();
      return;
    }

    setCurrentStep((step) => step - 1);
    setError("");
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSave() {
    if (loading) return;

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setError(VALIDATION_ERROR_MESSAGE);
      safeNotify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      const original = editingPet;
      const apiPetType = toApiPetType(normalizePetTypeValue(petType)!);

      const appendIfChanged = (key: string, value: any, originalValue: any) => {
        if (value !== originalValue) {
          formData.append(key, value);
        }
      };

      if (!editingPet) {
        formData.append("name", petName.trim());
        formData.append("type", apiPetType);
        formData.append("breed", breed.trim());
        formData.append("age", age.trim());
        formData.append("gender", gender.toLowerCase());
        formData.append("bio", bio.trim());
        formData.append("latitude", String(latitude));
        formData.append("longitude", String(longitude));
      } else {
        appendIfChanged(
          "name",
          petName.trim(),
          resolveOriginalPetName(original),
        );
        appendIfChanged(
          "type",
          apiPetType,
          resolveOriginalPetType(original),
        );
        appendIfChanged("breed", breed.trim(), original?.breed);
        appendIfChanged("age", age.trim(), String(original?.age));
        appendIfChanged(
          "gender",
          gender.toLowerCase(),
          String(original?.gender).toLowerCase(),
        );
        appendIfChanged("bio", bio.trim(), original?.bio);
        appendIfChanged("latitude", String(latitude), String(original?.latitude));
        appendIfChanged(
          "longitude",
          String(longitude),
          String(original?.longitude),
        );
      }

      const originalPhoto = original ? resolvePetImage(original) : null;
      const imageChanged = photo !== originalPhoto;

      if (imageChanged) {
        const upload = photoUpload?.uri === photo
          ? photoUpload
          : { uri: photo, name: "pet-photo.jpg", type: DEFAULT_UPLOAD_IMAGE_TYPE };

        if (Platform.OS === "web") {
          const resp = await fetch(upload.uri);
          const blob = await resp.blob();
          formData.append("image", blob, upload.name);
        } else {
          formData.append("image", {
            uri: upload.uri,
            name: upload.name,
            type: upload.type,
          } as any);
        }
      }

      if (medicalRecordPdf) {
        formData.append("medical_record_pdf", {
          uri: medicalRecordPdf.uri,
          name: medicalRecordPdf.name || "medical-record.pdf",
          type: medicalRecordPdf.mimeType || "application/pdf",
        } as any);
      }

      if (vaccinationPdf) {
        formData.append("vaccination_pdf", {
          uri: vaccinationPdf.uri,
          name: vaccinationPdf.name || "vaccination.pdf",
          type: vaccinationPdf.mimeType || "application/pdf",
        } as any);
      }

      if (idDocumentPdf) {
        formData.append("id_document_pdf", {
          uri: idDocumentPdf.uri,
          name: idDocumentPdf.name || "id-document.pdf",
          type: idDocumentPdf.mimeType || "application/pdf",
        } as any);
      }

      if (editingPet && !imageChanged) {
        const hasAnyField = Array.from((formData as any)._parts ?? []).length > 0;

        if (!hasAnyField) {
          setLoading(false);
          router.back();
          return;
        }
      }

      const result = editingPet
        ? await updatePet(String(editingPet.id), formData)
        : await createPet(formData);

      setLoading(false);

      if (result) {
        safeNotify(Haptics.NotificationFeedbackType.Success);
        const shouldContinueToAdoption =
          !editingPet && (adoptionMode === "true" || returnTo === "adoption");

        if (shouldContinueToAdoption) {
          if (result.id != null && result.id !== "") {
            router.replace(`/adoption/list-existing/${result.id}`);
          } else {
            Alert.alert(
              "Pet created. Choose it to continue listing for adoption.",
            );
            router.replace("/adoption/select-pet");
          }

          return;
        }

        router.back();
      } else {
        setError("We could not save this pet. Please try again.");
      }
    } catch (e) {
      setLoading(false);
      setError(friendlyErrorMessage(e, "Upload failed. Please try again."));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad + 12, paddingBottom: bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.setupHeader}>
          <TouchableOpacity
            accessibilityLabel="Close pet profile setup"
            accessibilityRole="button"
            activeOpacity={0.82}
            onPress={() => router.back()}
            style={[
              styles.closeButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.setupHeaderCopy}>
            <Text style={[styles.setupTitle, { color: colors.foreground }]}>
              {editingPet ? "Edit pet profile" : "Create pet profile"}
            </Text>
            <Text style={[styles.setupSubtitle, { color: colors.mutedForeground }]}>
              Tell us about your pet
            </Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.progressCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.progressCopy}>
              <Text style={[styles.progressTitle, { color: colors.foreground }]}>
                Profile progress
              </Text>

              <Text
                style={[styles.progressSub, { color: colors.mutedForeground }]}
              >
                {profileProgress >= 100
                  ? "Ready for discovery. Very fancy."
                  : "Complete the fields to unlock discovery."}
              </Text>
            </View>

            <Text style={[styles.progressValue, { color: typeMeta.color }]}>
              {profileProgress}%
            </Text>

            <View
              style={[
                styles.progressTrack,
                {
                  backgroundColor: colors.secondary,
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${profileProgress}%`,
                    backgroundColor: typeMeta.color,
                  },
                ]}
              />
            </View>
          </View>

          <View
            style={[
              styles.stepCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                Step {currentStep + 1}: {WIZARD_STEPS[currentStep]}
              </Text>
              <Text style={[styles.stepCount, { color: typeMeta.color }]}>
                {currentStep + 1}/{WIZARD_STEPS.length}
              </Text>
            </View>

            <View style={styles.stepDots}>
              {WIZARD_STEPS.map((step, index) => (
                <TouchableOpacity
                  key={step}
                  onPress={() => {
                    if (index <= currentStep || validateStep(currentStep)) {
                      setCurrentStep(index);
                    }
                  }}
                  disabled={loading}
                  activeOpacity={0.82}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        index <= currentStep ? typeMeta.color : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <Animated.View
            style={{
              opacity: stepAnim,
              transform: [
                {
                  translateY: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            }}
          >
          {currentStep === 1 && !!fieldErrors.photo ? (
            <View
              style={[
                styles.fieldErrorBox,
                {
                  backgroundColor: colors.destructive + "12",
                  borderColor: colors.destructive + "24",
                },
              ]}
            >
              <Feather
                name="image"
                size={15}
                color={colors.destructive}
              />

              <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
                {fieldErrors.photo}
              </Text>
            </View>
          ) : null}

          {currentStep === 0 ? (
            <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Basic Details
            </Text>

            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              This helps us build your pet identity card.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              PET NAME *
            </Text>

            <TextInput
              value={petName}
              onChangeText={(value) => {
                setPetName(value);
                clearFieldError("petName");
              }}
              placeholder="Buddy, Luna, Max..."
              placeholderTextColor={colors.mutedForeground}
              editable={!loading}
              style={[
                styles.fieldInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: fieldErrors.petName
                    ? colors.destructive
                    : colors.border,
                },
              ]}
            />

            {!!fieldErrors.petName && (
              <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
                {fieldErrors.petName}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              TYPE *
            </Text>

            <View style={styles.typeRow}>
              {SUPPORTED_PET_TYPES.map((t) => {
                const active = normalizePetTypeValue(petType) === t.value;

                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => {
                      if (loading) return;
                      if (normalizePetTypeValue(petType) !== t.value) {
                        setBreed("");
                        clearFieldError("breed");
                      }
                      setPetType(t.value);
                      clearFieldError("petType");
                      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? t.color : colors.input,
                        borderColor: active ? t.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={styles.typeEmoji}>{t.emoji}</Text>

                    <Text
                      style={[
                        styles.typeLabel,
                        {
                          color: active ? "#fff" : colors.foreground,
                        },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!!fieldErrors.petType && (
              <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
                {fieldErrors.petType}
              </Text>
            )}

            {editingPet && !normalizePetTypeValue(petType) ? (
              <View
                style={[
                  styles.fieldWarningBox,
                  {
                    backgroundColor: colors.warning + "12",
                    borderColor: colors.warning + "28",
                  },
                ]}
              >
                <Feather name="alert-triangle" size={15} color={colors.warning} />
                <Text style={[styles.fieldWarningText, { color: colors.warning }]}>
                  This pet type is no longer supported. Please choose Dog or Cat before saving.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.rowGroup}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text
                style={[styles.fieldLabel, { color: colors.mutedForeground }]}
              >
                BREED *
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (loading || !normalizedPetType) return;
                  setBreedPickerVisible(true);
                }}
                disabled={loading || !normalizedPetType}
                activeOpacity={0.84}
                style={[
                  styles.selectInput,
                  {
                    backgroundColor: colors.input,
                    borderColor: fieldErrors.breed
                      ? colors.destructive
                      : colors.border,
                    opacity: loading || !normalizedPetType ? 0.62 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.selectValue,
                    {
                      color: breed.trim()
                        ? colors.foreground
                        : colors.mutedForeground,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {breed.trim() || (normalizedPetType ? "Select breed" : "Choose pet type first")}
                </Text>

                <Feather
                  name="chevron-down"
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>

              {!!fieldErrors.breed && (
                <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
                  {fieldErrors.breed}
                </Text>
              )}
            </View>

            <View style={[styles.fieldGroup, { width: 94 }]}>
              <Text
                style={[styles.fieldLabel, { color: colors.mutedForeground }]}
              >
                AGE *
              </Text>

              <TextInput
                value={age}
                onChangeText={(value) => {
                  setAge(value.replace(/[^0-9]/g, ""));
                  clearFieldError("age");
                }}
                placeholder="3"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                editable={!loading}
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.input,
                    borderColor: fieldErrors.age
                      ? colors.destructive
                      : colors.border,
                  },
                ]}
              />

              {!!fieldErrors.age && (
                <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
                  {fieldErrors.age}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              GENDER *
            </Text>

            <View style={styles.genderRow}>
              {GENDERS.map((g) => {
                const active = gender === g.label;

                return (
                  <TouchableOpacity
                    key={g.label}
                    onPress={() => {
                      if (loading) return;
                      setGender(g.label);
                      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={[
                      styles.genderChip,
                      {
                        backgroundColor: active ? g.color + "18" : colors.input,
                        borderColor: active ? g.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.genderEmoji, { color: g.color }]}>
                      {g.emoji}
                    </Text>

                    <Text
                      style={[
                        styles.genderLabel,
                        {
                          color: active ? g.color : colors.foreground,
                        },
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Photo + Location
            </Text>

            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Helps nearby discovery without making exact location public
            </Text>
          </View>

          <TouchableOpacity
            onPress={showPhotoOptions}
            disabled={loading}
            activeOpacity={0.86}
            style={[
              styles.photoStepCard,
              {
                backgroundColor: photo ? typeMeta.color + "12" : colors.input,
                borderColor: photo ? typeMeta.color + "35" : colors.border,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.locationIcon,
                { backgroundColor: photo ? typeMeta.color + "18" : colors.secondary },
                {
                  transform: [
                    {
                      scale: photoReadyAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Feather
                name={photo ? "check-circle" : "camera"}
                size={16}
                color={photo ? typeMeta.color : colors.mutedForeground}
              />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.photoStepTitle, { color: colors.foreground }]}>
                {photo ? "Photo ready" : "Add a pet photo"}
              </Text>
              <Text style={[styles.photoStepSub, { color: colors.mutedForeground }]}>
                Upload or change the photo from here.
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              LOCATION *
            </Text>

            <TouchableOpacity
              onPress={detectLocation}
              disabled={locationLoading || loading}
              activeOpacity={0.85}
              style={[
                styles.locationRow,
                {
                  backgroundColor:
                    latitude !== null && longitude !== null
                      ? typeMeta.color + "12"
                      : colors.input,
                  borderColor:
                    fieldErrors.location || locationError
                      ? colors.destructive
                      : latitude !== null && longitude !== null
                      ? typeMeta.color + "35"
                      : colors.border,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.locationIcon,
                  {
                    backgroundColor:
                      latitude !== null && longitude !== null
                        ? typeMeta.color + "18"
                        : colors.secondary,
                    transform: [
                      {
                        scale: locationReadyAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Feather
                  name="map-pin"
                  size={16}
                  color={
                    latitude !== null && longitude !== null
                      ? typeMeta.color
                      : colors.mutedForeground
                  }
                />
              </Animated.View>

              <Text
                style={[
                  styles.locationText,
                  {
                    color:
                      latitude !== null && longitude !== null
                        ? colors.foreground
                        : colors.mutedForeground,
                  },
                ]}
                numberOfLines={1}
              >
                {locationLoading
                  ? "Detecting location..."
                  : location ||
                  (latitude !== null && longitude !== null
                    ? "Location selected"
                    : "Use my current location")}
              </Text>

              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: locationReadyAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.12],
                        }),
                      },
                    ],
                  }}
                >
                  <Feather
                    name={
                      latitude !== null && longitude !== null
                        ? "check-circle"
                        : "navigation"
                    }
                    size={15}
                    color={typeMeta.color}
                  />
                </Animated.View>
              )}
            </TouchableOpacity>

            {!!locationError && (
              <Text style={[styles.locationError, { color: colors.destructive }]}>
                {locationError}
              </Text>
            )}

            {!!fieldErrors.location && !locationError && (
              <Text style={[styles.locationError, { color: colors.destructive }]}>
                {fieldErrors.location}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              BIO *
            </Text>

            <TextInput
              value={bio}
              onChangeText={(value) => {
                setBio(value);
                clearFieldError("bio");
              }}
              placeholder={
                "Tell the world about your pet...\n\nWhat do they love? What are they like? What makes them special?"
              }
              placeholderTextColor={colors.mutedForeground}
              multiline
              onFocus={() => setBioFocused(true)}
              onBlur={() => setBioFocused(false)}
              editable={!loading}
              style={[
                styles.bioInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.input,
                  borderColor: fieldErrors.bio
                    ? colors.destructive
                    : bioFocused
                      ? typeMeta.color
                      : colors.border,
                  minHeight: bio.length > 120 ? 185 : 132,
                },
              ]}
              textAlignVertical="top"
            />

            <Text style={[styles.bioCount, { color: colors.mutedForeground }]}>
              {bio.length} characters
            </Text>

            {!!fieldErrors.bio && (
              <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
                {fieldErrors.bio}
              </Text>
            )}
          </View>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Documents
            </Text>

            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Optional PDFs
            </Text>
          </View>

          <View style={styles.documentList}>
            <PdfPickerField
              label="Medical Record PDF"
              buttonLabel="Upload Medical Record PDF"
              selectedFile={medicalRecordPdf}
              existingUrl={editingDocumentStatus?.medicalRecordPdfUrl}
              onChange={setMedicalRecordPdf}
              disabled={loading}
            />

            <PdfPickerField
              label="Vaccination PDF"
              buttonLabel="Upload Vaccination PDF"
              selectedFile={vaccinationPdf}
              existingUrl={editingDocumentStatus?.vaccinationPdfUrl}
              onChange={setVaccinationPdf}
              disabled={loading}
            />

            <PdfPickerField
              label="ID Document PDF"
              buttonLabel="Upload ID Document PDF"
              selectedFile={idDocumentPdf}
              existingUrl={editingDocumentStatus?.idDocumentPdfUrl}
              onChange={setIdDocumentPdf}
              disabled={loading}
            />
          </View>
            </>
          ) : null}

          {currentStep === 3 ? (
            <View
              style={[
                styles.reviewCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Review & Create
              </Text>
              <ReviewLine label="Name" value={petName.trim() || "Missing"} />
              <ReviewLine label="Type" value={normalizePetTypeValue(petType) || "Missing"} />
              <ReviewLine label="Breed" value={breed.trim() || "Missing"} />
              <ReviewLine label="Age" value={age.trim() ? `${age.trim()} years` : "Missing"} />
              <ReviewLine label="Gender" value={gender} />
              <ReviewLine
                label="Location"
                value={latitude !== null && longitude !== null ? location || "Selected" : "Missing"}
              />
              <ReviewLine label="Photo" value={photo ? "Ready" : "Missing"} />
              <ReviewLine
                label="Documents"
                value={[
                  medicalRecordPdf ? "Medical" : null,
                  vaccinationPdf ? "Vaccination" : null,
                  idDocumentPdf ? "ID" : null,
                ].filter(Boolean).join(", ") || "Optional, none selected"}
              />
            </View>
          ) : null}
          </Animated.View>

          {!!error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.destructive + "12",
                  borderColor: colors.destructive + "24",
                },
              ]}
            >
              <Feather name="alert-circle" size={15} color={colors.destructive} />

              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: footerPad,
          },
        ]}
      >
        <TouchableOpacity
          onPress={goToPreviousStep}
          disabled={loading}
          activeOpacity={0.88}
          style={[
            styles.backStepBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.secondary,
              opacity: loading ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backStepText, { color: colors.foreground }]}>
            {currentStep === 0 ? "Cancel" : "Back"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToNextStep}
          disabled={loading}
          activeOpacity={0.88}
          style={[
            styles.saveBtn,
            {
              backgroundColor: colors.primary,
              opacity: loading ? 0.7 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather
                name={
                  currentStep === WIZARD_STEPS.length - 1
                    ? editingPet
                      ? "check"
                      : "plus"
                    : "arrow-right"
                }
                size={20}
                color="#fff"
              />

              <Text style={styles.saveBtnText}>
                {currentStep === WIZARD_STEPS.length - 1
                  ? editingPet
                    ? "Save Changes"
                    : "Add Pet"
                  : "Next"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <BreedPickerModal
        visible={breedPickerVisible}
        options={breedOptions}
        value={breed}
        legacyValue={
          breed.trim() && canKeepCurrentLegacyBreed(breed)
            ? breed.trim()
            : null
        }
        onSelect={(value) => {
          setBreed(value);
          clearFieldError("breed");
          setBreedPickerVisible(false);
          safeHaptic(Haptics.ImpactFeedbackStyle.Light);
        }}
        onClose={() => setBreedPickerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

function BreedOptionRow({
  active,
  legacy,
  option,
  onSelect,
}: {
  active: boolean;
  legacy: boolean;
  option: string;
  onSelect: () => void;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.015 : 1,
      damping: 16,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onSelect}
        activeOpacity={0.84}
        style={[
          styles.breedOption,
          {
            backgroundColor: active ? colors.primary + "14" : colors.background,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.breedOptionText, { color: colors.foreground }]}>
            {option}
          </Text>
          {legacy ? (
            <Text
              style={[
                styles.breedOptionHint,
                { color: colors.mutedForeground },
              ]}
            >
              Current custom breed
            </Text>
          ) : null}
        </View>

        {active ? (
          <Feather name="check" size={18} color={colors.primary} />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

function BreedPickerModal({
  visible,
  options,
  value,
  legacyValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: string[];
  value: string;
  legacyValue?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      entry.setValue(0);
      return;
    }

    Animated.timing(entry, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [entry, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.modalBackdrop,
          {
            opacity: entry,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          style={[
            styles.breedSheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: entry.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.breedSheetHeader}>
            <Text style={[styles.breedSheetTitle, { color: colors.foreground }]}>
              Select breed
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.breedSheetClose,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.breedOptionsScroll}
            contentContainerStyle={styles.breedOptions}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => {
              const active = option === value;
              const legacy = legacyValue === option;

              return (
                <BreedOptionRow
                  key={option}
                  active={active}
                  legacy={legacy}
                  option={option}
                  onSelect={() => onSelect(option)}
                />
              );
            })}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  const colors = useColors();

  return (
    <View style={styles.reviewLine}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.reviewValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  setupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  setupHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  setupSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  card: {
    gap: 18,
  },
  progressCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  progressCopy: {
    paddingRight: 58,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  progressSub: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    lineHeight: 18,
  },
  progressValue: {
    position: "absolute",
    right: 18,
    top: 18,
    fontSize: 20,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  stepCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stepTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  stepCount: {
    fontSize: 13,
    fontWeight: "900",
  },
  stepDots: {
    flexDirection: "row",
    gap: 8,
  },
  stepDot: {
    flex: 1,
    height: 7,
    borderRadius: 999,
  },
  photoStepCard: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoStepTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  photoStepSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  reviewCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  reviewLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  reviewValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
  },
  backStepBtn: {
    flex: 0.42,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  backStepText: {
    fontSize: 15,
    fontWeight: "900",
  },

  sectionHeader: {
    gap: 2,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: "600",
  },

  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  fieldInput: {
    fontSize: 16,
    fontWeight: "700",
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
    borderWidth: 1,
  },
  selectInput: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  breedSheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  breedSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  breedSheetTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  breedSheetClose: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  breedOptionsScroll: {
    maxHeight: 430,
  },
  breedOptions: {
    gap: 9,
    paddingBottom: 8,
  },
  breedOption: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breedOptionText: {
    fontSize: 15,
    fontWeight: "800",
  },
  breedOptionHint: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  rowGroup: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-end",
  },

  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeChip: {
    minWidth: 104,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeEmoji: {
    fontSize: 18,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: "900",
  },

  genderRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 52,
    paddingVertical: 13,
    borderRadius: 20,
    borderWidth: 1,
  },
  genderEmoji: {
    fontSize: 16,
    fontWeight: "900",
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: "900",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  locationError: {
    fontSize: 12,
    fontWeight: "700",
  },
  fieldErrorText: {
    fontSize: 12,
    fontWeight: "700",
  },
  fieldErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  fieldWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  fieldWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },

  bioInput: {
    fontSize: 15,
    lineHeight: 23,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    fontWeight: "600",
  },
  bioCount: {
    fontSize: 11,
    textAlign: "right",
    fontWeight: "700",
  },

  documentList: {
    gap: 10,
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
  },
  documentMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  documentIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  documentCopy: {
    flex: 1,
    minWidth: 0,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  documentSub: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  documentClear: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  stickyFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 18,
    elevation: 8,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 58,
    borderRadius: 20,
    paddingHorizontal: 18,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
  },
});
