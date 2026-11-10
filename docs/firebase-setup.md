# Command Firebase connection
This integration is inactive until a dedicated Firebase project is configured.
1. Create a Command Firebase project at https://console.firebase.google.com/.
2. Register a web app and copy the public Web App configuration into firebase-config.js.
3. Enable Google provider under Authentication, and authorize downaironly.github.io.
4. Create Cloud Firestore in production mode and publish firestore.rules from this repository.
5. Deploy main with GitHub Pages. Test sign-in on Safari and installed iPhone PWA.
6. Use explicit cloud backup and restore buttons in Settings. They never sync automatically.
Google popup sign-in can fail in some iOS standalone contexts. Do not assume redirect works on GitHub Pages without the Firebase documented third-party storage workarounds.
No private admin credentials should ever be committed. Protect existing local data and keep exports.
