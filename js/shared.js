/* ============================================================
   NSUK CONNECT — shared.js
   Common utilities, Firebase init, auth guard, helpers
   ============================================================ */

// ── Firebase Config ──────────────────────────────────────────
// REPLACE these values with your Firebase project credentials.
// Firebase Console → Project Settings → Your Apps → Web App
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBcS9vKox6-WE3ij0cOZT3WCAsLmowPArg",
  authDomain:        "nsuk-connect-445a6.firebaseapp.com",
  projectId:         "nsuk-connect-445a6",
  storageBucket:     "nsuk-connect-445a6.firebasestorage.app",
  messagingSenderId: "959525662097",
  appId:             "1:959525662097:web:0c681e5a8ad45e13003e30"
};


// ── Firebase Init ────────────────────────────────────────────
if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// ── Cloudinary Config ────────────────────────────────────────
// Replace these with your Cloudinary dashboard values
const CLOUDINARY_CLOUD_NAME  = 'dujw58uol';   // e.g. 'dxyz123abc'
const CLOUDINARY_UPLOAD_PRESET = 'nsuk_connect'; // e.g. 'nsuk_connect'
/**
 * Upload a file to Cloudinary (free, no Firebase Storage needed)
 * @param {File} file - The file to upload
 * @param {string} folder - Folder name e.g. 'posts', 'profile_pictures'
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
async function uploadToCloudinary(file, folder = 'nsuk_connect') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Cloudinary upload failed');
  }

  const data = await res.json();
  return data.secure_url; // Public HTTPS URL
}

// ── In-memory user/post cache ────────────────────────────────
const userCache = {};   // uid → userData
const postCache = {};   // postId → postData
let _blockedUsers = []; // cached blocked user IDs

// Load blocked users list when auth state changes
auth.onAuthStateChanged(async user => {
  if (!user) { _blockedUsers = []; return; }
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    _blockedUsers = snap.data()?.blockedUsers || [];
  } catch(e) { _blockedUsers = []; }
});

// ── Auth helpers ─────────────────────────────────────────────
/** Redirect to login.html if not signed in */
function requireAuth(cb) {
  auth.onAuthStateChanged(user => {
    if (!user) { window.location.href = 'login.html'; return; }
    cb(user);
  });
}

/** Redirect to feed.html if already signed in */
function requireGuest(cb) {
  auth.onAuthStateChanged(user => {
    if (user) { window.location.href = 'feed.html'; return; }
    cb();
  });
}

// ── Fetch user data (with cache) ─────────────────────────────
async function getUser(uid) {
  if (!uid) return null;
  if (userCache[uid]) return userCache[uid];
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    userCache[uid] = { id: snap.id, ...snap.data() };
    return userCache[uid];
  } catch (err) {
    console.warn('getUser failed for uid:', uid, err.message);
    return null;
  }
}

function invalidateUser(uid) { delete userCache[uid]; }

// ── Avatar HTML ───────────────────────────────────────────────
function avatarHtml(user, size) {
  const fs = Math.round(size * 0.38);
  if (!user) return `<div class="avatar" style="width:${size}px;height:${size}px;"></div>`;
  if (user.profileImage) {
    return `<div class="avatar" style="width:${size}px;height:${size}px;">
      <img src="${user.profileImage}" alt="${esc(user.username)}">
    </div>`;
  }
  const init = (user.username || '?').slice(0,2).toUpperCase();
  return `<div class="avatar" style="width:${size}px;height:${size}px;">
    <div class="avatar-initials" style="font-size:${fs}px;">${init}</div>
  </div>`;
}

// ── Time formatting ───────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return 'just now';
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)     return 'just now';
  if (sec < 3600)   return Math.floor(sec/60)  + 'm ago';
  if (sec < 86400)  return Math.floor(sec/3600) + 'h ago';
  if (sec < 604800) return Math.floor(sec/86400)+ 'd ago';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

// ── HTML escape ────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(html) {
  let bd = document.getElementById('modal-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'modal-backdrop';
    bd.className = 'modal-backdrop hidden';
    bd.innerHTML = '<div class="modal-box" id="modal-box"></div>';
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if (e.target === bd) closeModal(); });
  }
  document.getElementById('modal-box').innerHTML = html;
  bd.classList.remove('hidden');
}
function closeModal() {
  const bd = document.getElementById('modal-backdrop');
  if (bd) bd.classList.add('hidden');
}

// ── Friendly Firebase auth errors ────────────────────────────
function authErr(code) {
  const map = {
    'auth/email-already-in-use': 'That email is already registered.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/too-many-requests':    'Too many attempts — please wait.',
    'auth/network-request-failed':'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Dark mode ─────────────────────────────────────────────────
function initDarkMode() {
  if (localStorage.getItem('nsuk_dark') === '1') {
    document.body.classList.add('dark');
  }
}
function toggleDark() {
  const on = document.body.classList.toggle('dark');
  localStorage.setItem('nsuk_dark', on ? '1' : '0');
  toast(on ? '🌙 Dark mode on' : '☀️ Light mode on');
}
initDarkMode();

// ── Build sidebar nav with active highlight ───────────────────
function buildNav(activePage) {
  const pages = [
    { id:'feed',          label:'Home',          href:'feed.html',          icon:`<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
    { id:'search',        label:'Search',        href:'search.html',        icon:`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>` },
    { id:'upload',        label:'New Post',      href:'upload.html',        icon:`<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>` },
    { id:'chat',          label:'Messages',      href:'chat.html',          icon:`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` },
    { id:'notifications', label:'Notifications', href:'notifications.html', icon:`<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`, badge:true },
    { id:'saved',         label:'Saved Posts',   href:'saved.html',         icon:`<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>` },
    { id:'profile',       label:'Profile',       href:'profile.html',       icon:`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` },
  ];

  // Desktop sidebar
  const navEl = document.getElementById('navbar');
  if (navEl) {
    navEl.innerHTML = `
      <div class="navbar-logo">
        <div class="logo-badge" style="background:transparent;padding:2px;border:2px solid var(--border);overflow:hidden;">
          <img src="images/nsuk_logo.jpg" alt="NSUK" style="width:32px;height:32px;object-fit:contain;border-radius:6px;">
        </div>
        NSUK Connect
      </div>
      ${pages.map(p => `
        <a href="${p.href}" class="nav-link ${p.id===activePage?'active':''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${p.icon}
          </svg>
          ${p.label}
          ${p.badge ? `<span class="badge" id="nav-notif-badge">0</span>` : ''}
        </a>
      `).join('')}
      <div class="navbar-bottom">
        <div class="nav-link" onclick="toggleDark()" style="cursor:pointer;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          Dark Mode
        </div>
        <div class="nav-user-info" onclick="window.location.href='profile.html'" id="nav-user-wrap">
          <div class="nav-avatar-sm" id="nav-user-av"><div class="avatar-initials" style="font-size:12px;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--green);color:#fff;">?</div></div>
          <span class="nav-user-name" id="nav-user-name">Loading…</span>
        </div>
      </div>`;
  }

  // Mobile bottom nav
  const mNav = document.getElementById('mobile-nav-inner');
  if (mNav) {
    mNav.innerHTML = pages.map(p => `
      <div class="mobile-nav-item ${p.id===activePage?'active':''}" onclick="window.location.href='${p.href}'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${p.icon}
        </svg>
        <span>${p.label}</span>
        ${p.badge ? `<span class="m-badge" id="mob-notif-badge">0</span>` : ''}
      </div>`).join('');
  }
}

// Fill nav user info after auth
function fillNavUser(userData) {
  // Guard: userData can be null if Firestore document not yet created
  if (!userData) {
    auth.onAuthStateChanged(async user => {
      if (!user) return;
      const fetched = await getUser(user.uid);
      if (fetched) fillNavUser(fetched);
    });
    return;
  }
  const nameEl = document.getElementById('nav-user-name');
  const avEl   = document.getElementById('nav-user-av');
  const name   = userData.displayName || userData.username || 'Student';
  if (nameEl) nameEl.textContent = name;
  if (avEl) {
    avEl.innerHTML = userData.profileImage
      ? `<img src="${userData.profileImage}" alt="">`
      : `<div class="avatar-initials" style="font-size:12px;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--green);color:#fff;">${name.slice(0,2).toUpperCase()}</div>`;
  }
}

// Notification badge helper
function setNotifBadge(n) {
  const d = document.getElementById('nav-notif-badge');
  const m = document.getElementById('mob-notif-badge');
  const s = n > 0 ? String(n > 9 ? '9+' : n) : '0';
  if (d) { d.textContent = s; n > 0 ? d.classList.add('show') : d.classList.remove('show'); }
  if (m) { m.textContent = s; n > 0 ? m.classList.add('show') : m.classList.remove('show'); }
}

// ── Add notification to Firestore ────────────────────────────
async function addNotif(targetUid, fromUid, type, postId, postImage) {
  if (targetUid === fromUid) return; // don't notify yourself
  try {
    await db.collection('notifications').add({
      targetUserId: targetUid,
      fromUserId:   fromUid,
      type,                         // 'like' | 'comment' | 'follow'
      postId:       postId  || '',
      postImage:    postImage|| '',
      read:         false,
      timestamp:    firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (_) {}
}

// ── Post card renderer ────────────────────────────────────────
async function renderPostCard(postId, post, currentUid) {
  const user  = await getUser(post.userId);
  if (!user) return '';

  // Skip posts from blocked users
  if (_blockedUsers && _blockedUsers.includes(post.userId)) return '';
  const liked = (post.likes || []).includes(currentUid);
  const likeN = (post.likes || []).length;
  const cmtN  = post.commentCount || 0;
  const isOwn = post.userId === currentUid;
  const av    = avatarHtml(user, 40);
  const uname = esc(user.displayName || user.username);

  return `
<article class="post-card" id="pc-${postId}" data-pid="${postId}" data-uid="${post.userId}">

  <!-- Header: avatar + username + options -->
  <div class="post-head">
    ${av}
    <div class="post-head-info">
      <div class="post-username" onclick="goProfile('${post.userId}')">${uname}</div>
      <div class="post-time">${timeAgo(post.timestamp)}</div>
    </div>
    <button class="post-menu-btn" onclick="toggleDD('${postId}')" aria-label="Options">⋯</button>
    <div class="post-dropdown hidden" id="dd-${postId}">
      ${isOwn ? `<div class="post-dd-item red" onclick="deletePost('${postId}')">🗑 Delete Post</div>` : ''}
      <div class="post-dd-item" onclick="sharePost('${postId}')">🔗 Share Post</div>
      <div class="post-dd-item" onclick="toggleBookmark('${postId}')">🔖 Save Post</div>
      ${!isOwn ? `<div class="post-dd-item" onclick="reportPost('${postId}')">🚩 Report Post</div>` : ''}
      ${!isOwn ? `<div class="post-dd-item red" onclick="blockUser('${post.userId}')">🚫 Block User</div>` : ''}
      <div class="post-dd-item" onclick="closeDD('${postId}')">✕ Close</div>
    </div>
  </div>

  <!-- Image (if any) — double-click to like -->
  ${post.imageUrl ? `
  <div class="post-image">
    <img src="${post.imageUrl}" alt="Post image" loading="lazy" ondblclick="likePost('${postId}',${liked})">
  </div>` : ''}

  <!-- Caption text (always shown) -->
  ${post.caption ? `
  <div class="post-caption" style="padding:10px 14px 6px;">
    <span class="cap-user" onclick="goProfile('${post.userId}')">${uname}</span>
    <span>${esc(post.caption)}</span>
  </div>` : ''}

  <!-- Comment previews -->
  <div class="comments-wrap" id="cw-${postId}" style="padding:0 14px;"></div>

  <!-- Action bar: Like | Comment | Share — placed BELOW the text -->
  <div class="post-actions" style="padding:6px 8px;border-top:1px solid var(--border);margin-top:6px;display:flex;align-items:center;gap:2px;">

    <!-- Like -->
    <button class="action-btn like-btn ${liked ? 'liked' : ''}" id="lb-${postId}"
      onclick="likePost('${postId}',${liked})" aria-label="Like">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        fill="${liked ? 'currentColor' : 'none'}">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span id="lc-${postId}">${likeN}</span>
    </button>

    <!-- Comment (clicking focuses the input box) -->
    <button class="action-btn" onclick="focusComment('${postId}')" aria-label="Comment">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span id="cc-${postId}">${cmtN}</span>
    </button>

    <!-- Share -->
    <button class="action-btn" onclick="sharePost('${postId}')"
      aria-label="Share" style="margin-left:auto;">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
      Share
    </button>
    <!-- Bookmark -->
    <button class="action-btn bookmark-btn" id="bm-${postId}" onclick="toggleBookmark('${postId}')" aria-label="Save post" style="margin-left:4px;">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" id="bm-svg-${postId}">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  </div>

  <!-- Likes count -->
  <div class="post-likes" id="pl-${postId}" style="padding:2px 14px 4px;">
    ${likeN === 1 ? '1 like' : `${likeN} likes`}
  </div>

  <!-- Inline comment input -->
  <div class="comment-bar">
    <input id="ci-${postId}" placeholder="Add a comment…"
      oninput="toggleCBtn('${postId}')"
      onkeydown="if(event.key==='Enter') quickComment('${postId}')">
    <button class="comment-post-btn" id="cpb-${postId}"
      onclick="quickComment('${postId}')">Post</button>
  </div>

</article>`;
}

// ── Post actions ──────────────────────────────────────────────
let _currentUid = null;
auth.onAuthStateChanged(u => { _currentUid = u ? u.uid : null; });

async function likePost(postId, currentlyLiked) {
  if (!_currentUid) return;
  const ref = db.collection('posts').doc(postId);
  const op  = currentlyLiked
    ? firebase.firestore.FieldValue.arrayRemove(_currentUid)
    : firebase.firestore.FieldValue.arrayUnion(_currentUid);
  await ref.update({ likes: op });

  if (!currentlyLiked) {
    const pd = await ref.get();
    if (pd.exists) addNotif(pd.data().userId, _currentUid, 'like', postId, pd.data().imageUrl||'');
  }
}

// Focus comment input when comment icon is clicked
function focusComment(postId) {
  const input = document.getElementById('ci-' + postId);
  if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  else openComments(postId);
}

function toggleCBtn(postId) {
  const inp = document.getElementById(`ci-${postId}`);
  const btn = document.getElementById(`cpb-${postId}`);
  if (inp && btn) btn.classList.toggle('on', inp.value.trim().length > 0);
}

async function quickComment(postId) {
  const inp = document.getElementById(`ci-${postId}`);
  if (!inp || !inp.value.trim() || !_currentUid) return;
  const text = inp.value.trim();
  inp.value = '';
  document.getElementById(`cpb-${postId}`)?.classList.remove('on');
  try {
    await db.collection('posts').doc(postId).collection('comments').add({
      userId:    _currentUid,
      text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('posts').doc(postId).update({
      commentCount: firebase.firestore.FieldValue.increment(1),
    });
    const pd = await db.collection('posts').doc(postId).get();
    if (pd.exists) addNotif(pd.data().userId, _currentUid, 'comment', postId, pd.data().imageUrl||'');
    toast('Comment posted!');
    loadCommentPreview(postId);
  } catch (_) { toast('Failed to post comment.'); }
}

async function loadCommentPreview(postId) {
  const wrap = document.getElementById(`cw-${postId}`);
  if (!wrap) return;
  const snap = await db.collection('posts').doc(postId)
    .collection('comments').orderBy('timestamp','desc').limit(2).get();
  const cmtN = snap.size;
  const postDoc = await db.collection('posts').doc(postId).get();
  const totalCmt = postDoc.exists ? (postDoc.data().commentCount||0) : cmtN;

  const rows = await Promise.all(snap.docs.reverse().map(async d => {
    const u = await getUser(d.data().userId);
    if (!u) return '';
    return `<div class="preview-comment"><span class="c-user">${esc(u.username)}</span>${esc(d.data().text)}</div>`;
  }));
  wrap.innerHTML = (totalCmt > 2 ? `<span class="see-all-btn" onclick="openComments('${postId}')">View all ${totalCmt} comments</span>` : '') + rows.join('');
}

async function openComments(postId) {
  const snap = await db.collection('posts').doc(postId)
    .collection('comments').orderBy('timestamp','asc').get();
  const rows = await Promise.all(snap.docs.map(async d => {
    const u = await getUser(d.data().userId);
    if (!u) return '';
    const av = u.profileImage
      ? `<div class="cmt-full-av"><img src="${u.profileImage}" alt=""></div>`
      : `<div class="cmt-full-av"><div class="av-init">${esc(u.username).slice(0,2).toUpperCase()}</div></div>`;
    return `<div class="cmt-full-row">${av}<div class="cmt-full-txt"><span class="cu">${esc(u.username)}</span> <span class="ct">${esc(d.data().text)}</span><div class="time">${timeAgo(d.data().timestamp)}</div></div></div>`;
  }));

  openModal(`
    <h3>Comments</h3>
    <div class="cmt-modal-list">${rows.length ? rows.join('') : '<p style="color:var(--text-muted);font-size:14px;">No comments yet.</p>'}</div>
    <div class="cmt-input-row">
      <input id="modal-cmt-in" placeholder="Add a comment…" onkeydown="if(event.key==='Enter') submitModalCmt('${postId}')">
      <button onclick="submitModalCmt('${postId}')">Post</button>
    </div>
    <div class="modal-footer"><button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button></div>
  `);
}

async function submitModalCmt(postId) {
  const inp = document.getElementById('modal-cmt-in');
  if (!inp || !inp.value.trim() || !_currentUid) return;
  const text = inp.value.trim(); inp.value = '';
  try {
    await db.collection('posts').doc(postId).collection('comments').add({
      userId: _currentUid, text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('posts').doc(postId).update({ commentCount: firebase.firestore.FieldValue.increment(1) });
    closeModal();
    toast('Comment posted!');
  } catch (_) { toast('Failed.'); }
}

async function deletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  closeAllDDs();
  try {
    await db.collection('posts').doc(postId).delete();
    document.getElementById(`pc-${postId}`)?.remove();
    toast('Post deleted.');
  } catch (_) { toast('Failed to delete.'); }
}

// ── Bookmark / Save post ─────────────────────────────────────
async function toggleBookmark(postId) {
  if (!_currentUid) return;
  const ref = db.collection('users').doc(_currentUid);
  const snap = await ref.get();
  const saved = snap.data().savedPosts || [];
  const isSaved = saved.includes(postId);

  if (isSaved) {
    await ref.update({ savedPosts: firebase.firestore.FieldValue.arrayRemove(postId) });
    toast('Post removed from saved.');
  } else {
    await ref.update({ savedPosts: firebase.firestore.FieldValue.arrayUnion(postId) });
    toast('Post saved! 🔖');
  }

  // Update icon fill
  const svg = document.getElementById('bm-svg-' + postId);
  if (svg) svg.setAttribute('fill', isSaved ? 'none' : 'currentColor');
}

// Load bookmark state for all visible posts
async function loadBookmarkStates() {
  if (!_currentUid) return;
  try {
    const snap = await db.collection('users').doc(_currentUid).get();
    const saved = snap.data().savedPosts || [];
    saved.forEach(postId => {
      const svg = document.getElementById('bm-svg-' + postId);
      if (svg) svg.setAttribute('fill', 'currentColor');
    });
  } catch(e) {}
}

// ── Report post ───────────────────────────────────────────────
async function reportPost(postId) {
  closeAllDDs();
  openModal(`
    <h3>Report Post</h3>
    <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">
      Why are you reporting this post?
    </p>
    <div style="display:flex;flex-direction:column;gap:8px;" id="report-options">
      ${['Spam or misleading','Inappropriate content','Harassment or bullying','False information','Other'].map(r =>
        `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;cursor:pointer;font-size:14px;">
          <input type="radio" name="report-reason" value="${r}" style="accent-color:var(--green);">
          ${r}
        </label>`
      ).join('')}
    </div>
    <div class="modal-footer" style="margin-top:16px;">
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="submitReport('${postId}')">Submit Report</button>
    </div>
  `);
}

async function submitReport(postId) {
  const selected = document.querySelector('input[name="report-reason"]:checked');
  if (!selected) { toast('Please select a reason.'); return; }
  try {
    await db.collection('reports').add({
      postId,
      reportedBy: _currentUid,
      reason: selected.value,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal();
    toast('Report submitted. Thank you. 🙏');
  } catch(e) { toast('Failed to submit report.'); }
}

// ── Block user ────────────────────────────────────────────────
async function blockUser(targetUid) {
  closeAllDDs();
  if (!confirm('Block this user? Their posts will no longer appear on your feed.')) return;
  try {
    await db.collection('users').doc(_currentUid).update({
      blockedUsers: firebase.firestore.FieldValue.arrayUnion(targetUid),
    });
    // Remove their posts from feed immediately
    document.querySelectorAll('.post-card').forEach(card => {
      if (card.dataset.uid === targetUid) card.remove();
    });
    toast('User blocked. ✅');
  } catch(e) { toast('Failed to block user.'); }
}

// ── Share post ───────────────────────────────────────────────
async function sharePost(postId) {
  closeAllDDs();
  const shareUrl = `${window.location.origin}/feed.html#${postId}`;

  // Use native share sheet on mobile if available
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'NSUK Connect Post',
        text:  'Check out this post on NSUK Connect!',
        url:   shareUrl,
      });
      return;
    } catch (_) {}
  }

  // Show share modal with options on desktop
  openModal(`
    <h3>Share Post</h3>
    <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">
      Share this post with your fellow NSUK students
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn btn-primary" onclick="copyPostUrl('${postId}')">
        🔗 Copy Link
      </button>
      <a href="https://wa.me/?text=${encodeURIComponent('Check out this post on NSUK Connect! ' + shareUrl)}"
        target="_blank" class="btn btn-outline" style="text-align:center;">
        💬 Share on WhatsApp
      </a>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this post on NSUK Connect!')}&url=${encodeURIComponent(shareUrl)}"
        target="_blank" class="btn btn-outline" style="text-align:center;">
        🐦 Share on Twitter/X
      </a>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
    </div>
  `);
}

function copyPostUrl(postId) {
  const shareUrl = `${window.location.origin}/feed.html#${postId}`;
  navigator.clipboard.writeText(shareUrl)
    .then(() => { toast('Link copied! 🔗'); closeModal(); })
    .catch(() => { toast('Could not copy link.'); });
}

function copyLink(postId) {
  navigator.clipboard.writeText(window.location.origin + '/feed.html#' + postId).catch(()=>{});
  toast('Link copied!'); closeAllDDs();
}

function toggleDD(postId) {
  closeAllDDs();
  document.getElementById(`dd-${postId}`)?.classList.toggle('hidden');
}
function closeDD(postId) { document.getElementById(`dd-${postId}`)?.classList.add('hidden'); }
function closeAllDDs(e) {
  if (e && e.target.classList.contains('post-menu-btn')) return;
  document.querySelectorAll('.post-dropdown').forEach(d => d.classList.add('hidden'));
}

// Close dropdowns when clicking outside
document.addEventListener('click', closeAllDDs);

// Navigate to a user profile
function goProfile(uid) {
  window.location.href = `profile.html?uid=${uid}`;
}
