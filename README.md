# ⚡ Premium Slack Clone

A corporate-grade, production-ready Slack clone web application designed with high-fidelity desktop and mobile layouts. Powered by **React**, **Vite**, **Tailwind CSS (v4)**, and **Firebase Suite (Authentication & Cloud Firestore)**.

---

## ✨ Features & Polish

1. **Pixel-Perfect Slack Desktop Client**:
   - Resizable 4-column desktop drawer (workspaces, channel navigation, chat viewport, members panel).
   - Dynamic hover workspace transitions and vertical indicator pills.
   - Perfectly aligned avatars and compact grouped messages sharing a clean 48px vertical axis.
2. **Real-time Synchronization**:
   - Live Firestore observers (`onSnapshot`) keep messages and channels in sync across multiple browser tabs instantaneously.
   - Self-seeding database strategy: automatically seeds standard channels and mock conversations upon first registration to immediately provide a high-fidelity collaboration environment.
3. **Google Authentication & Secure Auth Screens**:
   - Single-click **"Continue with Google"** integration with official branding layouts.
   - Session persistence (`onAuthStateChanged`) keeps users securely signed in upon refresh.
4. **Workspace Member Invites**:
   - Add registered members directly to your workspace using their registered email address.
   - Automatic Firestore validation prevents duplicate invites or uninvited lookups.
5. **Robust Security Rules**:
   - Full Firestore security rules protecting users, workspaces, channels, and messages from unauthenticated or uninvited access.
6. **Graceful Loading & Fallback Boundaries**:
   - Clean loading spinners during authentication, workspace synchronization, and channel updates.
   - Safe array fallback boundaries preventing TypeError type crashes even during heavy network lag.

---

## 🚀 Getting Started

### 1. Environment Configurations
Create a `.env` file in the root directory (use the structure declared in `.env.example`):

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

*Note: If no Firebase API keys are provided in `.env`, the app automatically switches into high-fidelity **Offline Developer Emulation Mode** using LocalStorage, enabling 100% functionality without internet!*

### 2. Local Installation
Clone the repository and install all dependencies:
```bash
# Install dependencies
npm install

# Run Vite local development server
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your web browser.

### 3. Production Compilation
Verify compilation clean checks:
```bash
npm run build
```
This minifies CSS/JS assets and prepares the deployable bundle inside the `dist` folder.

---

## ☁️ Firebase Deployment

We have prepared all Firebase CLI configurations (`firebase.json` and `.firebaserc` files) for zero-friction deployments.

### 1. Install Firebase Tools CLI
Ensure you have the Firebase CLI tools installed globally:
```bash
npm install -g firebase-tools
```

### 2. Deploy Firestore Rules
Update your Cloud Firestore security rules directly:
```bash
# Log in to your Firebase account
firebase login

# Deploy rules declared in firestore.rules
firebase deploy --only firestore:rules
```

### 3. Deploy Web App to Firebase Hosting
Deploy your static Vite assets to the cloud:
```bash
# Compile latest production bundle
npm run build

# Deploy compiled assets inside dist
firebase deploy --only hosting
```
Your application will be live at `https://your-project-id.web.app`!
