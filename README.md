# NSUK Connect — Multi-Page Website
### Campus social platform for Nasarawa State University, Keffi

---

## 📁 Project Structure

```
nsuk-connect/
│
├── index.html            ← Redirects to login.html
├── login.html            ← Login page
├── signup.html           ← Registration page
├── feed.html             ← Home feed (main page)
├── upload.html           ← Create new post
├── profile.html          ← User profile (own + others)
├── search.html           ← Search students
├── notifications.html    ← Activity & notifications
│
├── css/
│   └── style.css         ← All styles (shared across pages)
│
└── js/
    └── shared.js         ← Firebase, helpers, post rendering (shared)
```

---

## 🔥 Firebase Setup — Step by Step

### 1. Create a Firebase Project
1. Visit https://console.firebase.google.com
2. Click **Add project** → name it **NSUK Connect** → Continue
3. Disable Google Analytics if not needed → **Create project**

### 2. Register a Web App
1. In your Firebase project dashboard, click the **Web** icon `</>`
2. App nickname: `nsuk-connect` → Register app
3. **Copy the `firebaseConfig` object** — you'll need it next

### 3. Add Your Config to shared.js
Open `js/shared.js` and find lines 7–14. Replace with your config:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "nsuk-connect.firebaseapp.com",
  projectId:         "nsuk-connect",
  storageBucket:     "nsuk-connect.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

### 4. Enable Firebase Authentication
1. Firebase Console → **Authentication** → **Get started**
2. **Sign-in method** tab → Enable **Email/Password** → Save

### 5. Create Firestore Database
1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in test mode** (for development/submission)
3. Select region: `europe-west1` (closest to Nigeria) → Done

### 6. Enable Firebase Storage
1. Firebase Console → **Storage** → **Get started**
2. Start in test mode → Choose same region → Done

---

## 🔐 Firestore Security Rules (For Production)

In Firebase Console → Firestore → **Rules**, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['likes', 'commentCount'])
      );
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;

      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
      }
    }

    match /notifications/{notifId} {
      allow read: if request.auth != null && resource.data.targetUserId == request.auth.uid;
      allow create: if request.auth != null;
      allow update: if request.auth != null && resource.data.targetUserId == request.auth.uid;
    }
  }
}
```

---

## 📦 Storage Rules (For Production)

In Firebase Console → Storage → **Rules**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## 🗂️ Firestore Indexes Required

In Firebase Console → Firestore → **Indexes** → Composite, create:

| Collection     | Field 1           | Field 2                   |
|----------------|-------------------|---------------------------|
| posts          | timestamp (Desc)  | —                         |
| notifications  | targetUserId (Asc)| timestamp (Desc)          |
| notifications  | targetUserId (Asc)| read (Asc)                |
| users          | username (Asc)    | —                         |

---

## 🚀 Running the Website

### Option A — VS Code Live Server (Recommended)
1. Open the folder in VS Code
2. Install extension: **Live Server** (by Ritwick Dey)
3. Right-click `login.html` → **Open with Live Server**
4. Browser opens at `http://127.0.0.1:5500/login.html`

### Option B — Python HTTP Server
```bash
cd nsuk-connect
python -m http.server 8080
# Visit http://localhost:8080
```

### Option C — Firebase Hosting (Deploy Online)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Set public directory to: . (current folder)
# Single-page app: No
firebase deploy
# Your site will be at https://nsuk-connect.web.app
```

---

## ✅ Feature Checklist

| Feature | Status |
|---|---|
| Signup (username, email, password, photo) | ✅ |
| Login with Email & Password | ✅ |
| Logout | ✅ |
| Form validation (client-side) | ✅ |
| Home Feed — real-time, latest first | ✅ |
| Create Post (image + caption) | ✅ |
| Like / Unlike posts | ✅ |
| Comment on posts | ✅ |
| View all comments (modal) | ✅ |
| Delete own posts | ✅ |
| Profile page (stats, bio, post grid) | ✅ |
| Edit Profile (name, bio, photo) | ✅ |
| View other users' profiles | ✅ |
| Follow / Unfollow users | ✅ |
| Search users by username | ✅ |
| Notifications (likes, comments, follows) | ✅ |
| Dark mode toggle (persists across pages) | ✅ |
| Responsive (mobile + desktop) | ✅ |
| Separate pages for each section | ✅ |

---

## 🗄️ Database Schema

### `users`
| Field | Type | Description |
|---|---|---|
| username | string | Lowercase unique handle |
| displayName | string | Shown name |
| email | string | Auth email |
| profileImage | string | URL from Storage |
| bio | string | Short bio |
| followers | array | Array of UIDs |
| following | array | Array of UIDs |
| createdAt | timestamp | — |

### `posts`
| Field | Type | Description |
|---|---|---|
| userId | string | Owner UID |
| imageUrl | string | Storage URL |
| caption | string | Post text |
| likes | array | Array of UIDs |
| commentCount | number | Cached count |
| timestamp | timestamp | — |

### `posts/{id}/comments`
| Field | Type |
|---|---|
| userId | string |
| text | string |
| timestamp | timestamp |

### `notifications`
| Field | Type |
|---|---|
| targetUserId | string |
| fromUserId | string |
| type | 'like' / 'comment' / 'follow' |
| postId | string |
| postImage | string |
| read | boolean |
| timestamp | timestamp |

---

*Built with HTML, CSS, Vanilla JS + Firebase — NSUK Connect 🎓*
