# SmartSaver Sidebar

SmartSaver is a Manifest V3 browser extension for Chrome and Edge that saves selected text and links from any webpage into a fast right-side sidebar. It includes duplicate detection, search, filter, export, local backup, AI review, and Firebase sync through a secure local backend.

## Folder structure

```text
SmartSaverExtension/
├─ backend/
│  ├─ firebase-admin.js
│  └─ server.js
├─ content/
│  ├─ content.css
│  └─ content.js
├─ services/
│  ├─ api-client.js
│  └─ storage.js
├─ sidebar/
│  ├─ sidebar.css
│  ├─ sidebar.html
│  └─ sidebar.js
├─ .env.example
├─ .gitignore
├─ background.js
├─ manifest.json
└─ package.json
```

## Features

- Save selected text from the context menu
- Save links instantly from the context menu
- Keyboard shortcut: `Ctrl + Shift + S`
- Right-side animated sidebar UI
- Card-based saved item management
- Detailed item view
- Copy, AI Review, and Delete actions
- Groq API failover through backend keys
- Firebase Firestore sync by user ID
- Search and filter
- Duplicate detection
- Offline/local backup fallback
- JSON export
- Dark and light theme toggle

## Security model

- No Groq or Firebase secrets are stored in extension frontend files.
- Secrets belong in `.env`.
- The extension talks to `http://localhost:3000`.
- The backend talks to Groq and Firebase Admin.

## Setup

1. Open this folder: `C:\Users\jy475\Documents\SmartSaverExtension`
2. Copy `.env.example` to `.env`
3. Put your Groq and Firebase Admin values into `.env`
4. Install dependencies:

```powershell
npm install
```

5. Start the backend:

```powershell
npm start
```

6. Load the extension in Chrome or Edge:
   1. Open `chrome://extensions` or `edge://extensions`
   2. Enable Developer Mode
   3. Click `Load unpacked`
   4. Select `C:\Users\jy475\Documents\SmartSaverExtension`

## Usage

1. Highlight text on any page and right click `Save Selected Text`
2. Right click any link and choose `Save Link`
3. Press `Ctrl + Shift + S` to save the current selection
4. Click the extension icon to open the sidebar
5. Use `AI Review` to generate summary, key points, insights, and suggestions
6. Use `Sync` to sync through Firebase

## Testing checklist

Run these checks after loading the unpacked extension:

1. Save selected text from a webpage
2. Save a link from a webpage
3. Toggle sidebar from toolbar icon
4. Verify search and filter
5. Verify copy and delete actions
6. Verify AI Review with backend running
7. Verify sync with backend and Firebase configured
8. Verify export downloads JSON
9. Verify dark/light theme toggle
10. Verify duplicate saves are skipped

## Chrome Web Store deployment

1. Stop the local backend and keep `.env` out of the extension zip
2. Zip only the extension files you want shipped
3. Upload through the Chrome Web Store Developer Dashboard
4. Publish the backend separately on a secure server before production release
5. Update `backendUrl` in the sidebar settings to the deployed API

## Owner

- Jaswant Yadav
- `@jaswant_0707`
- `@the.chillcoder`
- `jaswanty132@gmail.com`
- `chillcoder4@gmail.com`
