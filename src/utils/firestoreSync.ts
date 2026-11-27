import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  appletAuth,
  db,
  handleFirestoreError,
  isFirestoreActiveForAuth,
  OperationType,
} from '../firebase';

export async function syncOwnFirestorePresenceAndProfile(params: {
  publicId: string;
  name: string;
  handle: string;
  photoUrl?: string | null;
  equippedFrameId?: string | null;
  vipLevel?: number;
  charmLevel?: number;
  online: boolean;
  email?: string | null;
  provider?: 'google' | 'facebook';
}): Promise<void> {
  if (!db || !isFirestoreActiveForAuth()) return;
  const fbUser = appletAuth?.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const uid = fbUser.uid;
  const publicPath = `userPublicProfiles/${uid}`;
  try {
    const publicRef = doc(db, 'userPublicProfiles', uid);
    const snap = await getDoc(publicRef);
    const rawPhoto = params.photoUrl ? String(params.photoUrl).trim() : '';
    const safeFirestorePhotoUrl =
      rawPhoto && !(rawPhoto.startsWith('data:') && rawPhoto.length > 1024)
        ? rawPhoto.slice(0, 1024)
        : null;
    const payloadBase = {
      uid,
      publicId: String(params.publicId || uid).slice(0, 24),
      name: String(params.name || 'OG Player').slice(0, 64),
      handle: String(params.handle || `@${params.publicId}`).slice(0, 48),
      photoUrl: safeFirestorePhotoUrl,
      equippedFrameId: params.equippedFrameId ? String(params.equippedFrameId).slice(0, 64) : null,
      online: Boolean(params.online),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(publicRef, {
        ...payloadBase,
        vipLevel: 0,
        charmLevel: 0,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(publicRef, {
        name: payloadBase.name,
        handle: payloadBase.handle,
        photoUrl: payloadBase.photoUrl,
        equippedFrameId: payloadBase.equippedFrameId,
        online: payloadBase.online,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, publicPath);
    } catch {
      // Logged cleanly by handleFirestoreError without disrupting session
    }
  }

  const presencePath = `presence/${uid}`;
  try {
    const presenceRef = doc(db, 'presence', uid);
    await setDoc(
      presenceRef,
      {
        uid,
        publicId: String(params.publicId || uid).slice(0, 24),
        online: Boolean(params.online),
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, presencePath);
    } catch {
      // Logged cleanly by handleFirestoreError without disrupting session
    }
  }

  const privatePath = `userPrivate/${uid}`;
  try {
    const privRef = doc(db, 'userPrivate', uid);
    const privSnap = await getDoc(privRef);
    const safeEmail = params.email ? String(params.email).slice(0, 254) : null;
    const safeProvider = params.provider === 'facebook' ? 'facebook' : 'google';
    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid,
        publicId: String(params.publicId || uid).slice(0, 24),
        email: safeEmail,
        provider: safeProvider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, {
        email: safeEmail,
        provider: safeProvider,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, privatePath);
    } catch {
      // Logged cleanly by handleFirestoreError
    }
  }
}
