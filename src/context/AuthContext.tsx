import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { syncUserProfile, updateUserDisplayName } from '../lib/userService';
import { UserProfile, AuthStatus } from '../types';

interface AuthContextValue {
  status: AuthStatus;
  user: FirebaseUser | null;
  profile: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Sync profile to Firestore users/{uid}
          const synced = await syncUserProfile(firebaseUser);
          setProfile(synced);
        } catch (err: unknown) {
          console.error('Failed to sync user profile to Firestore:', err);
          // Set fallback profile from auth credentials
          setProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          });
        }
        setStatus('authenticated');
      } else {
        setUser(null);
        setProfile(null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google Sign-In failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      // User closed popup or cancelled is benign
      if (message.includes('auth/popup-closed-by-user') || message.includes('cancelled-popup-request')) {
        return;
      }
      setError(message);
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await fbSignOut(auth);
    } catch (err: unknown) {
      console.error('Sign-Out failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      throw err;
    }
  };

  const updateDisplayName = async (newName: string) => {
    if (!user) throw new Error('Not authenticated');
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Display name cannot be empty.');
    }

    // 1. Update Firestore document users/{uid}
    await updateUserDisplayName(user.uid, trimmed);

    // 2. Synchronize Firebase Auth user profile
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: trimmed });
      } catch (err) {
        console.warn('Could not update Firebase Auth profile displayName:', err);
      }
    }

    // 3. Update local profile state immediately
    setProfile((prev) => (prev ? { ...prev, displayName: trimmed } : null));
  };

  const clearError = () => setError(null);

  const value = useMemo(
    () => ({
      status,
      user,
      profile,
      signInWithGoogle,
      signOut,
      updateDisplayName,
      error,
      clearError,
    }),
    [status, user, profile, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
