# Payphlo Android and Google Play release

Payphlo uses a Trusted Web Activity (TWA) so the Android app runs the production web experience at `https://payphlo.com` without duplicating the product in a second UI codebase.

## Current preparation

- The production web app is served over HTTPS.
- The web app exposes `/manifest.webmanifest` with 192px, 512px, and maskable icons.
- A service worker caches only public static assets. Authenticated pages and API responses are not cached.
- The Android application ID is reserved as `com.payphlo.app` for the generated project.

## Generate the Android project

Run these commands from the repository root after the PWA changes are deployed:

```bash
npx --yes @bubblewrap/cli init \
  --manifest=https://payphlo.com/manifest.webmanifest

npx --yes @bubblewrap/cli build
```

Use these values when Bubblewrap asks:

- Application name: `Payphlo`
- Package/application ID: `com.payphlo.app`
- Host: `payphlo.com`
- Start URL: `/`
- Display mode: `standalone`

Keep the generated upload keystore and its passwords outside Git. Losing the upload key can prevent future releases.

## Verify the website relationship

The TWA requires a Digital Asset Links file at:

```text
https://payphlo.com/.well-known/assetlinks.json
```

Add both fingerprints when applicable:

- The local upload key fingerprint for directly installed test builds.
- The Google Play App Signing fingerprint for builds installed from Google Play.

Without a matching fingerprint, Android opens the site as a Custom Tab instead of a full-screen Trusted Web Activity.

## Create the Play Console app

1. Create or verify a Google Play Console developer account.
2. Pay Google's one-time registration fee if the account is new.
3. Verify the developer identity, contact details, and Android device when requested.
4. Select **Create app** and use `Payphlo` as the app name.
5. Choose **App**, **Free**, and the appropriate default language.
6. Accept Play App Signing and upload the generated `.aab` file.
7. Complete the store listing, privacy policy, app-access instructions, content rating, target audience, ads declaration, and Data safety form.
8. Provide Google with working review credentials because Payphlo requires login.

## Test and release

1. Upload the first bundle to **Internal testing** and test it on a physical Android device.
2. Verify login, logout, transfers, investing, Phlo, navigation, back-button behavior, and recovery from a lost connection.
3. For a personal developer account created after November 13, 2023, run a closed test with at least 12 continuously opted-in testers for 14 days.
4. Apply for production access after the closed-test requirement is satisfied.
5. Create the production release and submit it for Google review.

## Official references

- Trusted Web Activity quick start: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- Create and set up an app: https://support.google.com/googleplay/android-developer/answer/9859152
- Personal-account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
