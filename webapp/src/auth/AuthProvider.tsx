import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import {
  completeSignupCompliance as completeSignupComplianceRequest,
  getMyProfile,
  getSignupComplianceStatus,
  updateMyProfile,
  type Profile,
  type ProfileUpdate,
  type SignupComplianceState,
} from '../lib/account';
import { supabase } from '../lib/supabase';
import {
  deleteAccount,
  requestPasswordReset,
  resendVerification,
  signIn,
  signInWithOAuth,
  signOut,
  signUp,
  updatePassword as updatePasswordRequest,
  type AuthResult,
  type OAuthProvider,
  type SignUpInput,
  type SignUpResult,
} from './auth';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  isPasswordRecovery: boolean;
  signupCompliance: SignupComplianceState;
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  refreshProfile: () => Promise<Profile | null>;
  updateProfile: (updates: ProfileUpdate) => Promise<Profile>;
  completeSignupCompliance: (birthdate: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isPasswordRecovery, setPasswordRecovery] = useState(false);
  const [signupCompliance, setSignupCompliance] = useState<SignupComplianceState>('unknown');
  const userIdRef = useRef<string | null>(null);
  const profileRequestRef = useRef(0);
  const userId = session?.user.id ?? null;
  userIdRef.current = userId;

  useEffect(() => {
    let active = true;
    const updateSession = (event: AuthChangeEvent, nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    };
    const { data: subscription } = supabase.auth.onAuthStateChange(updateSession);
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setProfile((current) => current?.id === userId ? current : null);
    setSignupCompliance('unknown');
    if (!userId) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active && userIdRef.current === userId) setSignupCompliance('unavailable');
    }, 10_000);
    void getSignupComplianceStatus(userId).then((state) => {
      if (!active || userIdRef.current !== userId) return;
      window.clearTimeout(timeout);
      setSignupCompliance(state);
    });
    return () => { active = false; window.clearTimeout(timeout); };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    const requestId = ++profileRequestRef.current;
    const expectedUserId = userId;
    if (!expectedUserId || signupCompliance !== 'complete') {
      setProfile(null);
      setProfileError(null);
      return null;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const nextProfile = await getMyProfile();
      if (profileRequestRef.current !== requestId || userIdRef.current !== expectedUserId) return null;
      setProfile(nextProfile);
      return nextProfile;
    } catch (error) {
      if (profileRequestRef.current === requestId && userIdRef.current === expectedUserId) {
        setProfileError(error instanceof Error ? error.message : 'Could not load profile.');
      }
      return null;
    } finally {
      if (profileRequestRef.current === requestId) setProfileLoading(false);
    }
  }, [signupCompliance, userId]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    const expectedUserId = userIdRef.current;
    if (!expectedUserId) throw new Error('Sign in required.');
    const nextProfile = await updateMyProfile(updates);
    if (userIdRef.current === expectedUserId) setProfile(nextProfile);
    return nextProfile;
  }, []);

  const completeSignupCompliance = useCallback(async (birthdate: string): Promise<AuthResult> => {
    try {
      await completeSignupComplianceRequest(birthdate);
      setSignupCompliance('complete');
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not finish account setup.' };
    }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const result = await updatePasswordRequest(password);
    if (!result.error) setPasswordRecovery(false);
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    profileError,
    isPasswordRecovery,
    signupCompliance,
    signIn,
    signUp,
    signInWithOAuth,
    requestPasswordReset,
    updatePassword,
    resendVerification,
    signOut,
    deleteAccount,
    refreshProfile,
    updateProfile,
    completeSignupCompliance,
  }), [
    session,
    profile,
    loading,
    profileLoading,
    profileError,
    isPasswordRecovery,
    signupCompliance,
    refreshProfile,
    updateProfile,
    completeSignupCompliance,
    updatePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
