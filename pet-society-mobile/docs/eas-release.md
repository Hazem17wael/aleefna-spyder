# Aleefna EAS Release Runbook

Use this runbook for release candidates only. Do not run submit commands until QA signs off on the exact build artifact.

## Build Commands

Production iOS build:

```bash
pnpm exec eas build --platform ios --profile production
```

Production Android build:

```bash
pnpm exec eas build --platform android --profile production
```

Build both platforms:

```bash
pnpm exec eas build --platform all --profile production
```

## Submit Commands

Documented for the release operator only. Do not run these before final approval.

```bash
pnpm exec eas submit --platform ios --profile production
pnpm exec eas submit --platform android --profile production
```

## Credential Setup

Open EAS credentials:

```bash
pnpm exec eas credentials
```

For the main iOS app target:

- Bundle identifier: `com.aleefna.app`.
- Confirm the App ID has Push Notifications enabled if push is used.
- Confirm the App ID has Sign in with Apple enabled.
- Confirm Associated Domains are not enabled unless a verified universal-links domain is added.

Native widgets are intentionally disabled for this release. Do not add a widget extension target or app-group entitlement unless the widget feature is restored in source and verified in a fresh production build.

Credential review must explicitly record:

- Main app App ID: `com.aleefna.app`.
- Main app provisioning profile includes Push Notifications and Sign in with Apple.
- The EAS build log shows only the main app target for Aleefna.

## Social Auth Setup

Apple:

- Enable Sign in with Apple for bundle `com.aleefna.app`.
- Apple social login is iOS only and must not appear on Android.
- Backend audience must include `SOCIAL_AUTH_APPLE_CLIENT_IDS=com.aleefna.app`.
- No Apple private key or client secret is required for the current mobile identity-token verification flow.

Google:

- Create a Google iOS OAuth client for bundle `com.aleefna.app`.
- Create a Google Android OAuth client for package `com.aleefna.app` using the release SHA-1/SHA-256 from EAS credentials.
- Create or identify the Google web OAuth client used for ID-token audience validation.
- Backend `SOCIAL_AUTH_GOOGLE_CLIENT_IDS` must include every accepted token audience, at minimum the web and iOS client IDs.
- Set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID, for example `com.googleusercontent.apps...`.

EAS public env setup:

```bash
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "GOOGLE_WEB_CLIENT_ID"
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "GOOGLE_IOS_CLIENT_ID"
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME --value "com.googleusercontent.apps.REVERSED_IOS_CLIENT_ID"
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value "GOOGLE_ANDROID_CLIENT_ID"
```

Backend env setup:

```bash
SOCIAL_AUTH_GOOGLE_CLIENT_IDS=GOOGLE_WEB_CLIENT_ID,GOOGLE_IOS_CLIENT_ID
SOCIAL_AUTH_APPLE_CLIENT_IDS=com.aleefna.app
SOCIAL_AUTH_HTTP_TIMEOUT=5
```

Never configure Facebook/admin social auth for the mobile app. Do not commit Google client secrets, Apple private keys, provider tokens, authorization codes, Sanctum tokens, or Authorization headers.

## IPA Inspection

Download the completed iOS `.ipa` from EAS, then inspect it locally:

```bash
mkdir -p /tmp/aleefna-ipa
unzip -q Aleefna.ipa -d /tmp/aleefna-ipa
find /tmp/aleefna-ipa/Payload -name "*.appex" -print
```

Expected: no `.appex` output while native widgets are disabled. This check is mandatory before TestFlight upload so the removed widget target is not accidentally packaged again.

Check bundle identifiers:

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" /tmp/aleefna-ipa/Payload/*.app/Info.plist
```

Expected values:

- Main app: `com.aleefna.app`.

Check entitlements after exporting the app bundle on macOS:

```bash
codesign -d --entitlements :- /tmp/aleefna-ipa/Payload/*.app
```

Expected: the main app includes the required production capabilities and does not include an unused widget app-group entitlement.

## Sentry Release Monitoring

The app has a minimal `@sentry/react-native` integration. It only sends events when `EXPO_PUBLIC_SENTRY_DSN` is set.

Create EAS secrets before a monitored release:

```bash
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://PUBLIC_DSN@sentry.io/PROJECT_ID"
pnpm exec eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "SENTRY_ORG_AUTH_TOKEN"
```

Source map upload still needs the real Sentry organization/project slugs. After they exist, add the Sentry Expo config plugin with:

- `organization`: Sentry organization slug.
- `project`: Sentry project slug.
- `SENTRY_AUTH_TOKEN`: EAS secret, never committed.

Do not use placeholder organization/project values in production builds.

## Version Strategy

- Marketing version comes from `expo.version`.
- iOS build number comes from `ios.buildNumber`, with EAS `autoIncrement` enabled for production.
- Android versionCode comes from `android.versionCode`, with EAS `autoIncrement` enabled for production.
- Never reuse a build number already uploaded to App Store Connect or Google Play.
- Bump marketing version only for user-visible release trains, not every QA build.

## Environment Notes

- The mobile runtime environment is production-only; app-env switching is not consumed by the app.
- API base URL must remain `https://api.aleefna.cloud/api` unless backend release ownership approves a change.
- Realtime builds should use secure websocket traffic through `api.aleefna.cloud` on port `443`.
- Keep public client config in EAS env/secrets rather than committing real service keys.
- Set `EXPO_PUBLIC_SENTRY_DSN` only for preview/production builds that should report to Sentry.
- Set Google social auth env values before any EAS build that includes social login; iOS EAS builds fail fast if `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` is missing.

## Rollback Notes

- Mobile rollback normally means stopping rollout and promoting the previous approved build, because installed iOS apps cannot be forcibly downgraded.
- If a backend-compatible bug ships, use App Store phased release controls or TestFlight group removal to limit exposure.
- Keep backend APIs backward compatible with at least the last approved mobile version.
- If push or realtime breaks, disable the server-side trigger first when possible; do not require an emergency app binary for server-controlled behavior.

## Pre-Submit Gate

- [ ] `pnpm exec tsc -p tsconfig.json --noEmit` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm dlx expo-doctor` passes or has reviewed known warnings only.
- [ ] `pnpm exec expo config --type prebuild --json` generates valid config.
- [ ] Mobile release checklist is complete on at least one current iPhone.
- [ ] Android release build installs and launches on a physical device or emulator.
- [ ] IPA inspection confirms no unexpected widget `.appex` is packaged.
- [ ] IPA entitlements confirm no unused widget app-group entitlement is present.
- [ ] Main app entitlement/capability confirms Sign in with Apple.
- [ ] Google iOS URL scheme is present in the iOS Info.plist.
- [ ] Backend social auth env accepts the exact Google and Apple audiences used by the build.
- [ ] Sentry test event appears in the correct environment, release, and build.
- [ ] Sentry sample event contains no tokens, emails, pet names, photos, locations, or message bodies.
- [ ] No EAS submit command has been run before final approval.
