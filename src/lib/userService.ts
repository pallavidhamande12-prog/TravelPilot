import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from './firebase';
import { UserProfile } from '../types';

/**
 * Creates or updates the user profile document in Firestore: users/{uid}
 *
 * Requirements:
 * - Use Firebase Authentication UID as document ID.
 * - Store only essential profile info: uid, displayName, email, photoURL, createdAt, lastLoginAt.
 * - Initially populate displayName, email and photoURL from authenticated Firebase user.
 * - If user exists, preserve any user-customized displayName.
 * - Update lastLoginAt on every sign-in.
 */
export async function syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
  if (user.uid.startsWith('demo-')) {
    return {
      uid: user.uid,
      displayName: user.displayName || 'Alex Morgan',
      email: user.email || 'alex.traveler@example.com',
      photoURL: user.photoURL || null,
    };
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const initialDisplayName = user.displayName?.trim() || 'Traveler';
      const newProfile: Record<string, unknown> = {
        uid: user.uid,
        displayName: initialDisplayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await setDoc(userRef, newProfile);

      return {
        uid: user.uid,
        displayName: initialDisplayName,
        email: user.email,
        photoURL: user.photoURL,
      };
    } else {
      // Existing user: preserve custom display name if already set
      const data = snap.data();
      const resolvedDisplayName = (data.displayName && data.displayName.trim()) || user.displayName?.trim() || 'Traveler';
      const resolvedEmail = user.email || data.email || '';
      const resolvedPhoto = user.photoURL || data.photoURL || '';

      await updateDoc(userRef, {
        displayName: resolvedDisplayName,
        email: resolvedEmail,
        photoURL: resolvedPhoto,
        lastLoginAt: serverTimestamp(),
      });

      return {
        uid: user.uid,
        displayName: resolvedDisplayName,
        email: resolvedEmail,
        photoURL: resolvedPhoto,
      };
    }
  } catch (err) {
    console.warn('Could not sync user profile with Firestore (using auth fallback):', err);
    return {
      uid: user.uid,
      displayName: user.displayName || 'Traveler',
      email: user.email || '',
      photoURL: user.photoURL || null,
    };
  }
}

/**
 * Fetch the authenticated user's profile document from users/{uid}
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (uid.startsWith('demo-')) {
    return {
      uid,
      displayName: 'Alex Morgan',
      email: 'alex.traveler@example.com',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
  }

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as UserProfile;
  } catch (err) {
    console.warn('Could not fetch user profile from Firestore:', err);
    return null;
  }
}

/**
 * Updates the user's displayName in users/{uid}.
 * Does not change UID, email, or authentication provider.
 */
export async function updateUserDisplayName(
  uid: string,
  newDisplayName: string
): Promise<void> {
  const trimmed = newDisplayName.trim();
  if (!trimmed) {
    throw new Error('Display name cannot be empty.');
  }

  if (uid.startsWith('demo-')) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('travelpilot_demo_display_name', trimmed);
    }
    return;
  }

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      displayName: trimmed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not persist updated displayName to Firestore:', err);
  }
}
