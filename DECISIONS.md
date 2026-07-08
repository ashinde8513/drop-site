# Decisions

## 2026-07-08 — Website stays separate from the app

trydropapp.com is the public browse-first website. It does not host the Expo web app or a browser login shell.

Account-bound actions belong to the native app. Legacy browser-app URLs (`/app*`, `app.trydropapp.com/*`, `/login`, `/login.html`) redirect to `download.html` so old links do not 404.
