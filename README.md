# WonderWeaves – Dobby Master

Textile weave designer (React + TypeScript + Vite).

## Builds
Push to `main` (or run the workflows manually from the **Actions** tab). Each run uploads:
- `desktop-windows-latest`: Windows installer (.exe) and portable .exe
- `desktop-macos-latest`: Mac .dmg (unsigned: right-click > Open the first time)
- `wonderweaves-android-apk`: Android .apk (debug-signed; allow "install unknown apps" on the tablet)

## Local development
```
npm install
npm run dev            # browser, http://localhost:3000
npm run electron:dev   # desktop window from a production build
```
Gemini AI features need a key at build time and are optional.
