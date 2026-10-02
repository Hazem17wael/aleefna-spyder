import React, { useEffect, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  uri?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  fallbackEmoji?: string;
  fallbackText?: string;
  fallback?: React.ReactNode;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
};

export function ImageFallback({
  uri,
  containerStyle,
  imageStyle,
  fallbackStyle,
  fallbackEmoji = "🐾",
  fallbackText,
  fallback,
  resizeMode = "cover",
  accessibilityLabel,
}: Props) {
  const [hasError, setHasError] = useState(false);
  const imageOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setHasError(false);
    imageOpacity.setValue(0);
  }, [imageOpacity, uri]);

  const showImage = Boolean(uri) && !hasError;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.fallback, fallbackStyle]}>
        {fallback ?? (
          <>
            <Text style={styles.emoji}>{fallbackEmoji}</Text>
            {fallbackText ? (
              <Text style={styles.text}>{fallbackText}</Text>
            ) : null}
          </>
        )}
      </View>

      {showImage ? (
        <Animated.Image
          source={{ uri: uri as string }}
          style={[
            StyleSheet.absoluteFill,
            imageStyle,
            { opacity: imageOpacity },
          ]}
          resizeMode={resizeMode}
          onLoad={() => {
            Animated.timing(imageOpacity, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }).start();
          }}
          onError={() => setHasError(true)}
          accessibilityLabel={accessibilityLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 28,
  },
  text: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.82)",
  },
});
