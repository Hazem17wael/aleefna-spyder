# Mobile Environment Configuration

The Expo app reads production API and Reverb settings from `EXPO_PUBLIC_*` environment variables. The runtime app environment is always production. Dev-client can still run, but it must use the same production-shaped values.

## Production

All app runs must provide an explicit HTTPS API base URL:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.aleefna.cloud/api

EXPO_PUBLIC_REALTIME_ENABLED=false
EXPO_PUBLIC_REVERB_KEY=
EXPO_PUBLIC_REVERB_HOST=
EXPO_PUBLIC_REVERB_PORT=443
EXPO_PUBLIC_REVERB_SCHEME=https

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

Configure these in EAS environment variables for EAS builds. Do not commit production secrets. `EXPO_PUBLIC_REVERB_KEY` is public client configuration, but keep the real value in EAS/environment configuration rather than committing it. If realtime variables are missing or `EXPO_PUBLIC_REALTIME_ENABLED` is not true, the app boots with realtime disabled and chat still uses the API.

Realtime connects only from explicit Reverb environment values. `EXPO_PUBLIC_REVERB_HOST` is the only host source, `EXPO_PUBLIC_REVERB_SCHEME` must be `https`, and websocket traffic uses WSS.

For EAS builds with realtime enabled, set the Reverb key outside git:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_REVERB_KEY --value "YOUR_BACKEND_REVERB_KEY"
```

The other release env values are defined in `eas.json` and use the production API/Reverb host across build profiles.

## Social Sign-In

Social sign-in uses native modules and therefore requires a development build or EAS build. Expo Go is not enough for Google Sign-In because the package needs native configuration.

Required public mobile env values:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Google web OAuth client ID used to request backend-verifiable ID tokens.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: Google iOS OAuth client ID for bundle `com.aleefna.app`.
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`: reversed iOS client ID, for example `com.googleusercontent.apps...`; required by `app.config.js` for EAS builds.
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`: Android OAuth client ID for release documentation and QA; Android still uses the web client ID at runtime for ID tokens.

Apple Sign in has no client secret in the mobile app. Keep `ios.usesAppleSignIn` enabled and enable the Sign in with Apple capability for `com.aleefna.app` in Apple Developer / EAS credentials.

Backend release env must also accept the same provider audiences:

```env
SOCIAL_AUTH_GOOGLE_CLIENT_IDS=WEB_CLIENT_ID,IOS_CLIENT_ID
SOCIAL_AUTH_APPLE_CLIENT_IDS=com.aleefna.app
SOCIAL_AUTH_HTTP_TIMEOUT=5
```

Do not commit Google client secrets, Apple private keys, provider tokens, authorization codes, Sanctum tokens, or Expo push tokens.
