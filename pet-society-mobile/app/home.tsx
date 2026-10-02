import { Redirect } from "expo-router";

export default function HomeDeepLinkRedirect() {
  return <Redirect href="/(tabs)" />;
}
