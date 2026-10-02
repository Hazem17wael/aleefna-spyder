# Aleefna Mobile Monitoring Plan

## Recommended Tooling

Aleefna now has a minimal `@sentry/react-native` SDK integration for Expo. It is disabled unless `EXPO_PUBLIC_SENTRY_DSN` is set, captures React ErrorBoundary failures, and scrubs sensitive fields before sending events.

The remaining production step is source map/native symbol upload. Do not add placeholder Sentry organization/project values to app config; configure them only after the real Sentry project exists.

Required EAS secrets:

```bash
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://PUBLIC_DSN@sentry.io/PROJECT_ID"
pnpm exec eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "SENTRY_ORG_AUTH_TOKEN"
```

Required Sentry identifiers before enabling upload:

- Sentry organization slug.
- Sentry project slug.
- Public DSN.
- Organization auth token scoped for release creation and source map upload.

## Required Event Context

Crash reports and handled errors should include only release-safe metadata:

- App release version from `expo.version`.
- iOS build number or Android versionCode.
- Environment: `staging`, `production`, or local development.
- Platform, OS version, device model, and app state.
- User id only when safe: prefer an internal numeric/string id or a one-way hash.
- Route name or screen group, not full URLs with tokens or identifiers.

## Breadcrumbs

Keep breadcrumbs useful but low risk:

- Navigation: screen names and route groups.
- API: endpoint group, HTTP method, response status, and duration.
- Auth: login/register/logout/session-expired events without credentials or tokens.
- Push: permission result, token registration success/failure, notification type.
- Widget: sync success/failure and app group availability.
- Realtime: connected, disconnected, subscribed, and reconnect events.

## Privacy Rules

Never send these values to monitoring:

- Auth tokens, refresh tokens, Expo push tokens, passwords, OTPs, or session cookies.
- Raw request/response bodies.
- Pet names, pet photos, user names, email addresses, phone numbers, exact location, chat messages, or notification text.
- Backend stack traces shown to the client.

Use `beforeSend` or equivalent filtering to scrub headers, query strings, request bodies, and custom context before events leave the device.

## Release Setup Checklist

- [x] Add `@sentry/react-native`.
- [x] Capture React ErrorBoundary failures.
- [x] Configure release, build number, and environment tags from Expo config.
- [x] Scrub tokens, emails, pet/user names, photos, locations, and message bodies before sending.
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` in EAS for preview/production builds.
- [ ] Configure source map upload after real Sentry organization/project slugs are available.
- [ ] Enable environment separation for staging and production.
- [x] Set safe user id after login and clear it on logout/session expiry.
- [ ] Add breadcrumbs for auth, API, push, widget, and realtime lifecycle events.
- [ ] Add alert routing for crash-free sessions, new issues, and high-volume regressions.
- [ ] Verify no sensitive fields appear in sample events before TestFlight rollout.

## Source Map Upload Setup

After the real Sentry organization and project exist, add the Expo config plugin using those exact slugs:

```json
[
  "@sentry/react-native/expo",
  {
    "url": "https://sentry.io/",
    "project": "SENTRY_PROJECT_SLUG",
    "organization": "SENTRY_ORG_SLUG",
    "note": "Use SENTRY_AUTH_TOKEN env to authenticate with Sentry."
  }
]
```

Keep `metro.config.js` using `getSentryExpoConfig(__dirname)` so bundles get Debug IDs.

Do not enable session replay, full network body capture, or `sendDefaultPii` until privacy filtering has been reviewed with real sample events.
