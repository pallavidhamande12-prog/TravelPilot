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
  signInAsDemo: () => void;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
  isDemoUser: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_UID = 'demo-traveler-uid';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  useEffect(() => {
    // Check if the user explicitly clicked "Sign Out" in this browser session
    const isExplicitSignOut =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('travelpilot_explicit_signout') === 'true';

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsDemoUser(false);
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
      } else if (!isExplicitSignOut) {
        // Auto-initialize Demo Traveler mode for seamless preview access
        const savedName =
          (typeof window !== 'undefined' &&
            localStorage.getItem('travelpilot_demo_display_name')) ||
          'Alex Morgan';
        const demoUser = {
          uid: DEMO_UID,
          displayName: savedName,
          email: 'alex.traveler@example.com',
          photoURL:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          emailVerified: true,
          isAnonymous: false,
        } as unknown as FirebaseUser;

        if (typeof window !== 'undefined') {
          localStorage.setItem('travelpilot_demo_session', 'true');
        }
        setIsDemoUser(true);
        setUser(demoUser);
        setProfile({
          uid: DEMO_UID,
          displayName: savedName,
          email: 'alex.traveler@example.com',
          photoURL:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        });
        setStatus('authenticated');
      } else {
        setUser(null);
        setProfile(null);
        setIsDemoUser(false);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('travelpilot_explicit_signout');
      }
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google Sign-In failed:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to sign in with Google';
      // User closed popup or cancelled is benign
      if (
        message.includes('auth/popup-closed-by-user') ||
        message.includes('cancelled-popup-request')
      ) {
        return;
      }

      // Any popup error (domain restrictions, invalid action, unauthorized domain, etc.)
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'this preview origin';
      const cleanMsg = message.replace(/^Firebase:\s*/i, '').replace(/Error\s*\((.*?)\)/, '$1');

      setAuthNotice(
        `Google Sign-In is unavailable on this preview URL (${cleanMsg}). Switched to Demo Traveler Mode so you can use all features immediately!`
      );
      // Automatically activate demo mode so user is never blocked
      signInAsDemo();
    }
  };

  const signInAsDemo = () => {
    setError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('travelpilot_explicit_signout');
      localStorage.setItem('travelpilot_demo_session', 'true');
    }
    const savedName =
      (typeof window !== 'undefined' &&
        localStorage.getItem('travelpilot_demo_display_name')) ||
      'Alex Morgan';
    const demoUser = {
      uid: DEMO_UID,
      displayName: savedName,
      email: 'alex.traveler@example.com',
      photoURL:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      emailVerified: true,
      isAnonymous: false,
    } as unknown as FirebaseUser;

    setIsDemoUser(true);
    setUser(demoUser);
    setProfile({
      uid: DEMO_UID,
      displayName: savedName,
      email: 'alex.traveler@example.com',
      photoURL:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });
    setStatus('authenticated');
  };

  const signOut = async () => {
    setError(null);
    setAuthNotice(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('travelpilot_demo_session');
      sessionStorage.setItem('travelpilot_explicit_signout', 'true');
    }
    setUser(null);
    setProfile(null);
    setIsDemoUser(false);
    setStatus('unauthenticated');
    try {
      await fbSignOut(auth);
    } catch (err: unknown) {
      console.warn('Sign-Out warning:', err);
    }
  };

  const updateDisplayName = async (newName: string) => {
    if (!user) throw new Error('Not authenticated');
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Display name cannot be empty.');
    }

    if (isDemoUser || user.uid === DEMO_UID) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('travelpilot_demo_display_name', trimmed);
      }
      setProfile((prev) => (prev ? { ...prev, displayName: trimmed } : null));
      return;
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
  const clearAuthNotice = () => setAuthNotice(null);

  const value = useMemo(
    () => ({
      status,
      user,
      profile,
      signInWithGoogle,
      signInAsDemo,
      signOut,
      updateDisplayName,
      error,
      clearError,
      isDemoUser,
      authNotice,
      clearAuthNotice,
    }),
    [status, user, profile, error, isDemoUser, authNotice]
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
