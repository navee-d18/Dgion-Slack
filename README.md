# ⚡ Premium Corporate-Grade Slack Clone

A corporate-grade, production-ready Slack clone web application designed with high-fidelity desktop and mobile layouts. Powered by **React**, **Vite**, **Tailwind CSS (v4)**, and **Firebase Suite (Authentication & Cloud Firestore)**. 

Featuring a highly polished, responsive, and blazing-fast interface, the application comes with a premium timezone-safe natural reminders engine, advanced WhatsApp-style message deletions, direct-mention triggers, atomic multi-tab state synchronizers, and a **stunning, highly readable Premium Dark Mode Redesign**!

---

## 🎨 Advanced Features & Production Polish

### 1. 👥 Workspace Invites & Strict Creator Permissions
* **Secure Database-Side Rules (`firestore.rules`)**:
  * Prevents manual DB bypass constraints: workspace updates, channel additions, and deletions are strictly validated at the database layer.
  * Restricted channel creation and metadata modifications exclusively to the creator (`isWorkspaceCreator`).
  * Non-members can self-join by *only* appending their own UID to the `members` array, keeping all other workspace properties locked.
* **Real-time Member Revocation**:
  * Creators can securely revoke member access. Firestore updates instantly, and a real-time listener callback instantly kicks out the revoked user and redirects them to onboarding with **zero page refreshes**.
  * Masked UI components for non-creators (add channel buttons, gear settings, and settings dropdowns are safely hidden).

### 2. ✍️ Rich Text Composer & Formatting Hotkeys
* **Markdown Inline Parser**: Built-in regular-expression based markdown utility to render `**bold**`, `*italics*`, `~~strikethrough~~`, `` `inline code` ``, and custom hyperlinks safely.
* **Keyboard Hotkeys**: Bindings for Bold (`Ctrl+B`) and Italic (`Ctrl+I`) text formatting on the fly, with `Enter` to post and `Shift+Enter` to write clean multiline logs.
* **Interactive Link Builder**: A modal drawer to construct verified custom hyperlink tags with custom labels.

### 3. 🔍 Fuzzy Search & Complete Emoji Library
* **Fuzzy Message Search**: A fast search overlay indexing active messages and matching search parameters in under a millisecond.
* **Searchable Emoji Picker**: Dedicated emoji library categorization mapping hundreds of icons across 9 Slack categories. Emojis are cleanly inserted at the composer cursor location, automatically keeping cursor selections aligned.

### 4. 📝 Real-Time Message Editing & Starred Bookmarks
* **Inline Editing**: Double-clicking a message bubble or hitting "Edit message" replaces it with an active inline editor. committing is bound to `Enter` and canceling to `Esc`.
* **Edited Indicator**: Saved edits append a clean visual `(edited)` timestamp badge to the message row.
* **Hover Actions Bar**: Reveals a premium transitions toolbar on row hover containing Quick Reactions, Thread Reply indicators, and a local Bookmark Star trigger.

### 5. 💬 Decoupled Thread Panel Drawer
* **Dynamic Replies Sidebar**: Opening a thread replies feed slides in a right-hand panel (`w-[400px]` desktop, responsive bottom drawer on mobile).
* **Independent Stream**: Decoupled reply compose loops, attachments, and scroll hooks that keep thread discussions self-contained.
* **Parent Deletion Safety**: If the parent thread message is deleted globally, the thread panel renders a safe notice *"Original message deleted"* while preserving all replies beneath it.

### 6. 🟢 Real-Time Presence & Idle Heartbeats
* **Strict 2-State System**: Offline presence dots automatically transition to `🟢 Online` (HSL green `#2BAC76`) or `⚫ Offline` (slate-400) based on user activity.
* **Focus & Activity Trackers**: Listens to focus, keystroke, click, and touch interactions on the window to dynamically toggle presence.
* **Conflict-Avoidance Heartbeats**: Throttled writes (once every 2 minutes) that cross-examine doc updates. If another active browser tab has written a live status within the last 4.5 minutes, the idle tab skips writing offline, preventing status conflicts for multi-session active users.

### 7. 🏷️ Keyboard steering @Mentions & Profile Cards
* **Teammate Mentions**: Typing `@` triggers a floating overlay with keyboard steering (ArrowUp/ArrowDown to cycle, Enter to commit, Escape to close).
* **Click Event Delegation**: Mention links inside messages act as delegators. Clicking a mention slides open a beautiful **`UserProfileModal`** card displaying online states, displaying self-status updates, copy-to-clipboard email chimes, and DMs redirection.
* **Removed Teammate Guard**: If a mention belongs to a deleted or removed member, it displays a safe fallback card: *"User no longer available"*.

### 8. 🎤 Coordination Voice Notes & Soundwaves
* **Global Voice Player Coordination**: An absolute window event coordinator (`voice-note-played`) ensures that clicking Play on any voice note instantly pauses all other active players globally, preventing overlapping audio.
* **Blinking Recording Status**: Blinking indicators count up live to a strict 3:00 limit. Reaching the limit auto-stops the recorder, locks controls, and presents Send and Cancel buttons.
* **Multipliers & Scrubbing**: Supports speed multipliers (`1x` -> `1.5x` -> `2x`) and mobile-ready seeking sliders for precise audio scrubbing.
* **Status Prompts**: Integrates microphone-denied warning bars and displays live recording statuses (e.g. `🎤 Alice is recording...`) above composers.

### 9. 🗑️ WhatsApp-Style Advanced Message Delete
* **Delete Scopes**: Choose between **"Delete for me"** (persists locally across refreshes) or **"Delete for everyone"** (purges globally). If performed by the workspace creator on another member's message, it renders as an **"Admin delete"**.
* **Placeholders & Cleanup**: Deleted cards display dynamic placeholders (*"This message was deleted"*) with custom timestamps. Purges all files, bookmarks, reactions, and unread notifications instantly.

### 10. ⏰ Natural Time Reminders Engine
* **Command Time Parser**: A robust natural-language parser resolving timezone-safe `/remind` commands (`10 PM today`, `5:10 PM`, `tomorrow 9 AM`, `in 5 mins`).
* **Parsed Preview Banner**: Displays a live visual parsed preview above the composer as the user types (e.g. `📅 Reminder set for Today 10:00 PM: "meeting"`), ensuring clarity prior to saving.
* **Atomic Trigger Transactions**: Heartbeat engines run on a 1-second interval, executing Firestore transactions (`runTransaction`) and synchronous locks to guarantee reminders trigger **exactly once** across multiple open tabs.

### 11. 📅 UX-Optimized Scheduled Message Pickers
* **Smart Auto-Defaulting**: Opening the scheduler popover automatically initializes the input fields to today's date and the next nearest 5-minute future slot (e.g. `17:33` current time defaults to `17:35`).
* **Live Picker Locks**: Attaches `min` attributes to the custom date picker (prior dates disabled) and time picker (past times today disabled), muting past options in browser selectors.
* **Double Validation Guard**: Manual invalid entries are blocked on click, displaying a clean alert **`Please choose a future date and time`** and raising a pulsing warning banner below custom inputs.

### 12. 🔗 Slack-Style Deep-Linking Navigation
* ** Smooth Centering Scroll**: Clicking unread notification bells smoothly scrolls and places the targeted message perfectly centered (`block: 'center'`) in the active chat pane.
* **Retry After Load Engine**: If the targeted message belongs to a channel that is loading, a retry engine runs every 100ms for up to 3 seconds, gliding to the message the instant it renders.
* **Transition Target Highlight**: Focuses the targeted message with a premium soft-blue background (`#E8F5FA`) and left border (`#36C5F0`) that smoothly fades back to transparent over a 2000ms CSS transition.

### 13. 🌙 Redesigned Polished Premium Dark Mode
* **Premium Palette Overrides**:
  * **App Background**: `#0F1117` (premium rich-midnight)
  * **Main Containers**: `#161A23` (refined dark surface)
  * **Primary Sidebar**: `#3F0E40` (classic Slack purple dark)
  * **Secondary Channels Sidebar**: `#2B1230` (deep, modern grape-purple)
  * **Composer & Card Elements**: `#1D2430` (contrasting dark blue-gray card fill)
  * **Borders**: `#2A3442` (refined, high-contrast dark border lines)
* **High Contrast Typography**: Primary text (`#F8FAFC`), secondary (`#CBD5E1`), muted details (`#94A3B8`), and links/mentions (`#38BDF8`).
* **250ms Fade Transitions**: Redefined core layouts to transition background, text, border, and shadow properties over a smooth 250ms curve, eliminating raw flashes or shifts.
* **Toggle Switch Redesign**: Tracks are styled to exact dimensions (`48px` x `28px`) with circular thumbs (`22px x 22px`) vertically centered (`top-[3px]`) and sliding symmetrically between `left-[3px]` (OFF, `#334155`) and `left-[23px]` (ON, `#1264A3`) with no outer glow.
* **Balanced Theme Cards**: Selector cards share an equal height of `92px`, clean border rings, soft blue backgrounds when active, centered text, and transitioning radio buttons.
* **Charcoal Modals**: Polish modal dialogs with deep dark background (`#111827`), card containers (`#1E293B`), borders (`#334155`), `16px` border-radius, and a beautiful soft blur backdrop filter.

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
