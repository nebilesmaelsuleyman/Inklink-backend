# 🚀 InkLink - Collaborative & AI-Powered Backend Core

Welcome to the **InkLink Backend Engine**. Built with NestJS, Mongoose, and TypeScript, this progressive Node.js server serves as the core coordinator for the InkLink social reading and collaborative writing platform. It is engineered with robust transaction databases, atomic state locks, collaborative Yjs syncing, and AI moderation pipelines.

---

## 🛠️ Key Architectural Components

### 1. 🛡️ AI Moderation Pipeline
- **Automated Text Verification**: Intercepts title and content submissions, routing them to the local moderation engine for sentiment and safety classification.
- **Safety Tags**: Sets explicit `childSafe` and `adultSafe` tags to filter search and browse listings based on reader status.
- **Dual Manual Approvals**: Exposes secure NestJS guards for administrative endpoints, supporting manual overrides:
  - **Approve for Children**: Sets `childSafe: true`, `adultSafe: false`.
  - **Approve for Both**: Sets `childSafe: true`, `adultSafe: true`.

### 2. ✍️ Real-Time Collaborative Yjs Engine
- Seamlessly resolves concurrent user keystrokes for collaborative editing sessions.
- Persists document states atomically to prevent save conflicts or data loss.

### 3. 💳 Wallet & Chapa Payment Gateway
- **Transaction Processing**: Tracks dynamic subscription payments and premium chapter purchases using atomic Mongoose operators.
- **Transaction Log Ledger**: Supports logging of multiple transaction typologies, including `SUBSCRIPTION` (premium subscriptions), `PREMIUM` (locked contents in ETB), `DONATION`, and `AD` earnings.
- **Real-Time Revenue Analytics**: Aggregates earnings over granular temporal dimensions (Today, This Week, This Month, This Year, All-Time) with built-in platform commission calculators.

### 4. 🎙️ Neural Text-to-Speech (TTS)
- Translates dynamic chapter contents into neural speech streams on-the-fly.
- Supports sentence-boundary chunking, language routing (Amharic & English), and standard streaming formats.

### 5. 👥 Social Network Graph & Feed Announcements
- Tracks follow relationships between readers and authors.
- Dispatches atomic database-driven notifications upon new book publications or chapter additions to keep bookmarks and followers updated in real-time.

---

## 🛠️ Technology Stack

- **Framework**: NestJS (TypeScript Node.js)
- **Database**: MongoDB (via Mongoose ODM)
- **Real-Time Communication**: Socket.io & Yjs Collaborative WebSockets
- **External APIs**: Chapa Integration, AI Moderation Services
- **Validation**: class-validator & class-transformer

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js (v18+), MongoDB (running locally or in a container), and npm installed.

### Installation

1. Navigate to the backend directory:
   ```bash
   cd ink-link_backend/backend
   ```

2. Install core dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file inside the `backend` folder:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/inklink
   JWT_SECRET=your_jwt_signing_secret_here
   MODERATION_SERVICE_URL=http://localhost:8000
   CHAPA_API_KEY=your_chapa_secret_key
   ```

4. Compile and Run the Server:
   ```bash
   # Development mode with hot-reloading
   npm run start:dev

   # Build production package
   npm run build

   # Start production server
   npm run start:prod
   ```

---

## 📁 Repository Directory Map

```
src/
├── common/             # Global interceptors, custom decorators, and core guards (e.g. AdminRoleGuard)
├── modules/
│   ├── admin/          # Platform wide overviews, financial ledgers, pricing updates, and core subscription checks
│   ├── auth/           # Secure JWT-based registration, logins, and route guards
│   ├── chapters/       # Book chapters, locking rules, safety tags, and publication announcements
│   ├── collaboration/  # Shared workspace tracking for co-authored titles
│   ├── moderation/     # AI text validation wrappers and fallback guards
│   ├── notifications/  # Follower feeds and real-time app notifications
│   ├── profile/        # Social graphs, followers/following profiles
│   ├── subscription/   # Chapa payment processing, plan registries, and subscription models
│   ├── tts/            # Text-to-Speech neural stream generation
│   ├── wallet/         # Ledger journals and atomic transactions
│   └── works/          # Authors' book collections, tagging, and browse aggregates
```

---

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.
