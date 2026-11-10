# Command Firebase setup

**Connected public Web App configuration:** Firebase project `command-c8162`.
No private credentials belong in the public repository.

## Required Firebase Console setup

1. Authentication → Sign-in method → Google → Enable and Save.
2. Authentication → Settings → Authorized domains → add `downaironly.github.io`.
3. Firestore Database → Create database if needed, in production mode.
4. Firestore → Rules → paste and **Publish** the contents of `firestore.rules` from this repository. Committing the rules file does not deploy the rules.
5. Open https://downaironly.github.io/planner/, go to Settings → Google account → Sign in with Google. Test login in Safari and installed iPhone PWA. A popup may fail in some standalone iOS environments; if it does, inspect the Firebase error and implement the documented workaround instead of changing hosting.

## Behavior and limitations

- The Firebase client code uses the supplied public Web App configuration.
- Login must be enabled and rules must be published in the console before Cloud Backup can be used.
- A signed-in user can explicitly **Save cloud backup** or **Restore cloud backup**. Neither sign-in nor launch silently uploads or overwrites local data.
- Cloud backups are account-specific at `users/{uid}/backups/current` and use an optimistic revision check.
- No automatic multi-device synchronization or conflict reconciliation yet.
- Backup payload limited to 850 KB; larger data needs a future per-record sync architecture.
- Keep the original `command.v1` record and export JSON backups during initial verification.
- Analytics is intentionally not initialized; it is unnecessary for Authentication and Firestore.

GitHub Pages settings: https://github.com/DownAirOnly/planner/settings/pages
GitHub Actions: https://github.com/DownAirOnly/planner/actions
Firebase rules: https://console.firebase.google.com/project/command-c8162/firestore/rules
