import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Headphones,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  FIREBASE_PROJECT_ID,
  auth,
  facebookProvider,
  firebaseConfigError,
  getActiveAuthProjectId,
  googleProvider,
  resolveAuthForCurrentDomain,
} from '../firebase';
import type { AuthProvider } from '../types';
import { soundFx } from '../utils/soundFx';

export interface VerifiedLoginPayload {
  provider: AuthProvider;
  name: string;
  identifier: string;
  photoUrl?: string;
  token: string;
  uid: string;
  publicId: string;
  handle: string;
  role: 'normal_user' | 'support_staff' | 'moderator' | 'admin' | 'super_admin';
  charmPoints: number;
  vipLevel: number;
  vipStatus: 'Not Active' | 'Active';
  vipGrowth: number;
  vipPlanLabel?: string | null;
  coins: number;
  giftsReceived: number;
  accountStatus: 'Active' | 'Suspended' | 'Banned';
  isNewUser: boolean;
}

export interface AuthErrorInfo {
  code: string;
  message: string;
  showUnauthorizedDomainHelp?: boolean;
}

export interface AuthScreenProps {
  onLogin: (payload: VerifiedLoginPayload) => void;
  onVerifyFirebaseUser?: (user: User, preferredProvider?: AuthProvider) => Promise<VerifiedLoginPayload>;
  initialError?: AuthErrorInfo | null;
  onClearError?: () => void;
}

function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function mapFirebaseAuthError(err: unknown): AuthErrorInfo {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const fallbackMsg =
    err instanceof Error ? err.message : 'Authentication failed. Please try again.';

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        showUnauthorizedDomainHelp: true,
        message: `Domain (${window.location.hostname}) is not authorized in Firebase Console for "${FIREBASE_PROJECT_ID}". Add it under Authentication → Settings → Authorized domains.`,
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: 'Sign-In popup was blocked by your browser. Allow popups or tap Continue with Google again.',
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: 'Sign-In popup was closed before completing verification.',
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        message: `This sign-in provider is not enabled yet in Firebase project "${FIREBASE_PROJECT_ID}". Enable it in Firebase Authentication → Sign-in method.`,
      };
    case 'auth/account-exists-with-different-credential':
      return {
        code,
        message: 'An account already exists with this email using another sign-in method.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: 'Network error communicating with Firebase Authentication. Check your connection and retry.',
      };
    case 'auth/invalid-phone-number':
      return {
        code,
        message: 'Enter a valid E.164 phone number with country code (e.g. +919876543210).',
      };
    case 'auth/invalid-verification-code':
      return {
        code,
        message: 'Incorrect 6-digit SMS OTP code. Please check your SMS and try again.',
      };
    case 'auth/code-expired':
      return {
        code,
        message: 'SMS OTP expired. Request a new verification code.',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Too many OTP attempts from this device. Wait a moment before retrying.',
      };
    default:
      return { code: code || 'auth/unknown', message: fallbackMsg };
  }
}

const GoogleLogo: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
  onVerifyFirebaseUser,
  initialError = null,
  onClearError,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(
    firebaseConfigError
      ? { code: 'auth/invalid-config', message: firebaseConfigError }
      : initialError
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);

  useEffect(() => {
    if (!firebaseConfigError && initialError) {
      setErrorInfo(initialError);
    }
  }, [initialError]);

  const exchangeFirebaseUser = async (user: User, preferredProvider?: AuthProvider) => {
    if (onVerifyFirebaseUser) {
      const payload = await onVerifyFirebaseUser(user, preferredProvider);
      setStatusMessage('Account verified. Launching OG VELOCITY...');
      soundFx.playVictory();
      onLogin(payload);
      return;
    }

    const idToken = await user.getIdToken(true);
    const resp = await fetch('/api/auth/verify-firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      token?: string;
      isNewUser?: boolean;
      user?: {
        uid: string;
        publicId: string;
        email: string | null;
        phone: string | null;
        name: string;
        photoUrl?: string | null;
        handle: string;
        provider: AuthProvider;
        role: VerifiedLoginPayload['role'];
        charmPoints: number;
        vipLevel: number;
        vipStatus: 'Not Active' | 'Active';
        vipGrowth: number;
        vipPlanLabel?: string | null;
        coins: number;
        giftsReceived: number;
        accountStatus: 'active' | 'suspended' | 'banned';
      };
    };

    if (!resp.ok || !data.ok || !data.token || !data.user) {
      if (auth) await signOut(auth).catch(() => {});
      throw new Error(data.error || 'Backend verification of Firebase token failed.');
    }

    setStatusMessage('Account verified. Launching OG VELOCITY...');
    soundFx.playVictory();
    onLogin({
      provider: preferredProvider || data.user.provider || 'google',
      name: data.user.name,
      identifier: data.user.email || data.user.phone || data.user.publicId,
      photoUrl: data.user.photoUrl || user.photoURL || undefined,
      token: data.token,
      uid: data.user.uid,
      publicId: data.user.publicId,
      handle: data.user.handle,
      role: data.user.role || 'normal_user',
      charmPoints: Number(data.user.charmPoints ?? 0),
      vipLevel: Number(data.user.vipLevel ?? 0),
      vipStatus: data.user.vipStatus === 'Active' ? 'Active' : 'Not Active',
      vipGrowth: Number(data.user.vipGrowth ?? 0),
      vipPlanLabel: data.user.vipPlanLabel ?? null,
      coins: Number(data.user.coins ?? 0),
      giftsReceived: Number(data.user.giftsReceived ?? 0),
      accountStatus:
        data.user.accountStatus === 'banned'
          ? 'Banned'
          : data.user.accountStatus === 'suspended'
            ? 'Suspended'
            : 'Active',
      isNewUser: Boolean(data.isNewUser),
    });
  };

  const handleGoogleLogin = async () => {
    setErrorInfo(null);
    onClearError?.();
    setStatusMessage('');
    if (firebaseConfigError) {
      setErrorInfo({ code: 'auth/invalid-config', message: firebaseConfigError || 'Invalid Firebase configuration.' });
      return;
    }
    setLoading(true);
    let redirecting = false;
    try {
      const resolved = await resolveAuthForCurrentDomain();
      const activeAuth = resolved.auth || auth;
      if (!activeAuth) {
        setErrorInfo({ code: 'auth/invalid-config', message: 'Firebase Auth is not initialized.' });
        return;
      }
      if (!resolved.isDomainAuthorized) {
        setErrorInfo({
          code: 'auth/unauthorized-domain',
          showUnauthorizedDomainHelp: true,
          message: `Domain (${resolved.currentHost || window.location.hostname}) is not yet authorized in Firebase Auth for "${resolved.projectId || getActiveAuthProjectId()}".`,
        });
        return;
      }
      const result = await signInWithPopup(activeAuth, googleProvider);
      await exchangeFirebaseUser(result.user, 'google');
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      console.error('[Auth] Google sign-in error:', mapped.code);
      if (
        (mapped.code === 'auth/popup-blocked' ||
          mapped.code === 'auth/operation-not-supported-in-this-environment') &&
        !isInsideIframe()
      ) {
        try {
          const resolved = await resolveAuthForCurrentDomain();
          const activeAuth = resolved.auth || auth;
          if (activeAuth) {
            redirecting = true;
            setStatusMessage('Opening Google Sign-In redirect...');
            await signInWithRedirect(activeAuth, googleProvider);
            return;
          }
        } catch (redirectErr) {
          redirecting = false;
          const redirectMapped = mapFirebaseAuthError(redirectErr);
          console.error('[Auth] Google redirect fallback error:', redirectMapped.code);
          setErrorInfo(redirectMapped);
          return;
        }
      }
      setErrorInfo(mapped);
    } finally {
      if (!redirecting) {
        setLoading(false);
      }
    }
  };

  const handleFacebookLogin = async () => {
    setErrorInfo(null);
    onClearError?.();
    setStatusMessage('');
    if (firebaseConfigError) {
      setErrorInfo({ code: 'auth/invalid-config', message: firebaseConfigError || 'Invalid Firebase configuration.' });
      return;
    }
    setLoading(true);
    let redirecting = false;
    try {
      const resolved = await resolveAuthForCurrentDomain();
      const activeAuth = resolved.auth || auth;
      if (!activeAuth) {
        setErrorInfo({ code: 'auth/invalid-config', message: 'Firebase Auth is not initialized.' });
        return;
      }
      if (!resolved.isDomainAuthorized) {
        setErrorInfo({
          code: 'auth/unauthorized-domain',
          showUnauthorizedDomainHelp: true,
          message: `Domain (${resolved.currentHost || window.location.hostname}) is not yet authorized in Firebase Auth for "${resolved.projectId || getActiveAuthProjectId()}".`,
        });
        return;
      }
      const result = await signInWithPopup(activeAuth, facebookProvider);
      await exchangeFirebaseUser(result.user, 'facebook');
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      console.error('[Auth] Facebook sign-in error:', mapped.code);
      if (
        (mapped.code === 'auth/popup-blocked' ||
          mapped.code === 'auth/operation-not-supported-in-this-environment') &&
        !isInsideIframe()
      ) {
        try {
          const resolved = await resolveAuthForCurrentDomain();
          const activeAuth = resolved.auth || auth;
          if (activeAuth) {
            redirecting = true;
            setStatusMessage('Opening Facebook Sign-In redirect...');
            await signInWithRedirect(activeAuth, facebookProvider);
            return;
          }
        } catch (redirectErr) {
          redirecting = false;
          const redirectMapped = mapFirebaseAuthError(redirectErr);
          console.error('[Auth] Facebook redirect fallback error:', redirectMapped.code);
          setErrorInfo(redirectMapped);
          return;
        }
      }
      setErrorInfo(mapped);
    } finally {
      if (!redirecting) {
        setLoading(false);
      }
    }
  };

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const handleCopyHostname = () => {
    if (!currentHost || !navigator.clipboard) return;
    navigator.clipboard.writeText(currentHost).then(() => {
      setCopiedDomain(true);
      window.setTimeout(() => setCopiedDomain(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#1E132B] via-[#130F1B] to-[#0B0912] px-4 py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-purple-400/25 bg-[#161024]/90 p-7 shadow-2xl shadow-purple-500/20 backdrop-blur-xl sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/30 via-fuchsia-500/20 to-cyan-500/20 shadow-lg shadow-purple-500/20">
            <Headphones className="h-7 w-7 text-cyan-300" />
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Voice Rooms · Multiplayer Arena · Social</span>
          </div>

          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-white">
            OG VELOCITY
          </h1>
          <p className="mt-2 text-xs text-slate-300">
            Verify with Firebase Authentication to access Voice Rooms, Carrom, UNO, Laser Tag, Wallet &amp; VIP.
          </p>
        </div>

        <div className="mt-6 space-y-3.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || Boolean(firebaseConfigError)}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleLogo />
            <span>
              {loading
                ? 'Verifying Account...'
                : 'Continue with Google'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleFacebookLogin}
            disabled={loading || Boolean(firebaseConfigError)}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#1877F2]/50 bg-[#1877F2] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-[#1877F2]">
              f
            </span>
            <span>Continue with Facebook</span>
          </button>

          {statusMessage && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-xs text-emerald-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorInfo && (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-red-400/35 bg-red-500/10 p-3 text-xs text-red-200"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="font-semibold text-red-100">{errorInfo.message}</div>
              </div>
              {errorInfo.showUnauthorizedDomainHelp && currentHost && (
                <button
                  type="button"
                  onClick={handleCopyHostname}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/30 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                >
                  {copiedDomain ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedDomain ? 'Copied hostname' : `Copy "${currentHost}"`}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>Firebase Backend-Verified Sessions · No Unverified Logins</span>
        </div>
      </div>
    </div>
  );
};