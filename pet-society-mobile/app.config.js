const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const googlePluginName = "@react-native-google-signin/google-signin";

const managedPluginNames = new Set([
  googlePluginName,
  "expo-audio",
  "expo-sharing",
  "expo-asset",
  "expo-image-picker",
  "expo-location",
  "expo-document-picker",
]);

module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;

    return !managedPluginNames.has(pluginName);
  });

  plugins.push([
    "expo-audio",
    {
      microphonePermission:
        "Aleefna needs microphone access so you can record voice notes in chat.",
      recordAudioAndroid: true,
    },
  ]);

  plugins.push("expo-sharing");
  plugins.push("expo-asset");

  plugins.push([
    "expo-image-picker",
    {
      photosPermission:
        "Aleefna needs photo library access so you can send pet photos in chat.",
      cameraPermission:
        "Aleefna needs camera access so you can take and send photos in chat.",
    },
  ]);

  plugins.push([
    "expo-location",
    {
      locationWhenInUsePermission:
        "Aleefna uses your location only when you choose to share it in chat.",
    },
  ]);

  plugins.push("expo-document-picker");

  if (googleIosUrlScheme) {
    plugins.push([
      googlePluginName,
      {
        iosUrlScheme: googleIosUrlScheme,
      },
    ]);
  } else if (
    process.env.EAS_BUILD === "true" &&
    process.env.EAS_BUILD_PLATFORM !== "android"
  ) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is required for EAS iOS builds with Google Sign-In.",
    );
  }

  return {
    ...config,
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
    },
    plugins,
  };
};