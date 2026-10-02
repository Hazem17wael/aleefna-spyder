# Aleefna Mobile Release Checklist

Use this checklist for every TestFlight, internal Android, and production candidate build. Record device model, OS version, build number, environment, and tester initials for each run.

## Account And Session

- [ ] Login succeeds with a verified account.
- [ ] Login fails safely for invalid credentials.
- [ ] Register creates an account and reaches OTP/onboarding flow.
- [ ] OTP verification signs the user in.
- [ ] Logout clears the session and returns to auth screens.
- [ ] Expired token: force a 401, confirm the app clears auth state and returns to login without showing protected data.
- [ ] Expired token after a notification/deep link does not render protected data.

## Social Sign-In

- [ ] Google sign-in appears on iOS and Android release/dev builds.
- [ ] Google sign-in creates a new verified user and lands in the protected app.
- [ ] Google sign-in links to an existing OTP account when the provider email is verified and matches.
- [ ] Google cancellation returns to the auth screen without creating a session.
- [ ] Google invalid/provider failure shows a safe error and logs no provider token.
- [ ] Apple sign-in appears on iOS when Google sign-in is present.
- [ ] Apple sign-in does not appear on Android.
- [ ] Apple sign-in creates or links a verified account and lands in the protected app.
- [ ] Apple cancellation returns to the auth screen without creating a session.
- [ ] Social login registers push token after auth, connects realtime, and syncs care state like email login.

## Routing And Deep Links

- [ ] Logged-out deep link to tabs redirects to login/onboarding.
- [ ] Logged-out deep link to chat redirects to login/onboarding.
- [ ] Logged-out notification tap stores the destination, completes login, and replays the destination once.
- [ ] Logged-out custom scheme link, for example `aleefna://chat/123`, replays once after login.
- [ ] Logged-in deep link to a protected screen opens the target or safe fallback.
- [ ] Logged-in notification tap opens the target route immediately.
- [ ] Authenticated user is not sent back to login unexpectedly.
- [ ] Reopening the app after replay does not repeat the old pending destination.

## Permissions

- [ ] Camera permission denied: app shows safe error and remains usable.
- [ ] Camera permission allowed: take pet photo works.
- [ ] Photo permission denied: app shows safe error and remains usable.
- [ ] Photo permission allowed: choose pet photo works.
- [ ] Location permission denied: app shows safe error and manual flow remains usable.
- [ ] Location permission allowed: nearby/location detection works.
- [ ] Push notification permission denied: app continues without push registration.
- [ ] Push notification permission allowed: Expo push token registration succeeds.

## Notifications

- [ ] Foreground match notification is suppressed in favor of realtime match UI.
- [ ] Foreground message notification shows banner/list/sound/badge.
- [ ] Foreground care reminder shows banner/list/sound/badge.
- [ ] Background notification appears in system notification center.
- [ ] Killed-state notification tap opens the expected route/deep link.
- [ ] Killed-state notification tap while logged out replays after login.
- [ ] Killed-state notification tap while logged in opens the target route without duplicate navigation.
- [ ] Local pet care reminder tap focuses care content when expected.
- [ ] Push permission denied does not retry prompt loops.
- [ ] Realtime match event and push notification do not create duplicate match modals.

## Core Product Flows

- [ ] Add pet with camera image.
- [ ] Add pet with photo library image.
- [ ] Add pet with location.
- [ ] Edit pet.
- [ ] Delete pet.
- [ ] Swipe like/dislike.
- [ ] Match event appears once, without duplicate popups.
- [ ] Chat loads messages if conversation is available.
- [ ] Chat send message works if conversation is available.
- [ ] Notifications list loads.
- [ ] Mark notification read.
- [ ] Mark all notifications read.

## Native Widgets

- [ ] Native widgets are intentionally disabled for this release.
- [ ] IPA inspection shows no widget extension `.appex`.
- [ ] App entitlements do not include an unused app group for widgets.

## Monitoring

- [ ] `EXPO_PUBLIC_SENTRY_DSN` is set for the release build.
- [ ] Sentry test event arrives with environment, release, and build number.
- [ ] ErrorBoundary crash is captured by Sentry.
- [ ] Sentry event sample contains no token, email, pet name, user name, exact location, image URL, or chat body.

## Build Checks

- [ ] iOS TestFlight candidate installs and launches.
- [ ] iOS TestFlight candidate has correct bundle id: `com.aleefna.app`.
- [ ] iOS TestFlight candidate has correct build number/version.
- [ ] iOS TestFlight candidate was created only after IPA inspection and launch smoke test passed.
- [ ] Android build installs and launches.
- [ ] Android build has correct package: `com.aleefna.app`.
- [ ] Android build has correct versionCode/version.
- [ ] Android background/foreground notification behavior matches the iOS QA result or has documented platform-specific differences.
