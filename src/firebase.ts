import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  FacebookAuthProvider,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import appletFirebaseConfig from '../firebase-applet-config.json';

export const FIREBASE_PROJECT_ID = 'og-velocity';
export const FIREBASE_WEB_API_KEY = 'AIzaSyCWMhFzpTkrcWEEjGEwkItHtGJ8AYjKg_Q';

export const OG_VELOCITY_FIREBASE_CONFIG = {
  apiKey: FIREBASE_WEB_API_KEY,
  authDomain: 'og-velocity.firebaseapp.com',
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: 'og-velocity.firebasestorage.app',
  messagingSenderId: '981732109993',
  appId: '1:981732109993:web:41110fc90be5293abd83b8',
  measurementId: 'G-SH4179E2GK',
};

export const APPLET_FIREBASE_CONFIG = {
  apiKey: appletFirebaseConfig.apiKey,
  authDomain: appletFirebaseConfig.authDomain,
  projectId: appletFirebaseConfig.projectId,
  storageBucket: appletFirebaseConfig.storageBucket,
  messagingSenderId: appletFirebaseConfig.messagingSenderId,
  appId: appletFirebaseConfig.appId,
  firestoreDatabaseId: appletFirebaseConfig.firestoreDatabaseId,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function validateFirebaseConfig(cfg: Record<string, unknown>): string | null {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  for (const key of required) {
    const val = String(cfg[key] ?? '').trim();
    if (!val || val.startsWith('MY_') || val.includes('remixed-')) {
      return `Invalid Firebase configuration: missing or placeholder "${key}".`;
    }
  }
  return null;
}

function shouldPreferOgVelocityForHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (
    host === 'ogvelocity.xyz' ||
    host.endsWith('.ogvelocity.xyz') ||
    host === 'og-velocity.firebaseapp.com' ||
    host === 'og-velocity.web.app' ||
    host === 'og-velocity.ai.studio'
  ) {
    return true;
  }
  return false;
}

const currentHostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
const preferOgVelocityInitially = shouldPreferOgVelocityForHost(currentHostname);

let ogApp: FirebaseApp | null = null;
let appletApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let ogAuthInstance: Auth | null = null;
let appletAuthInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let activeProjectId: string = preferOgVelocityInitially
  ? OG_VELOCITY_FIREBASE_CONFIG.projectId
  : APPLET_FIREBASE_CONFIG.projectId;
let configError: string | null =
  validateFirebaseConfig(OG_VELOCITY_FIREBASE_CONFIG) || validateFirebaseConfig(APPLET_FIREBASE_CONFIG);
let persistenceReady: Promise<void> = Promise.resolve();

async function configureAuthPersistence(targetAuth: Auth): Promise<void> {
  await setPersistence(targetAuth, browserLocalPersistence)
    .catch(() => setPersistence(targetAuth, indexedDBLocalPersistence))
    .catch(() => setPersistence(targetAuth, browserSessionPersistence))
    .catch((err) => {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : 'unknown';
      console.warn('[Firebase] Auth persistence fallback skipped:', code);
    });
}

function initNamedApp(name: string, cfg: typeof OG_VELOCITY_FIREBASE_CONFIG | typeof APPLET_FIREBASE_CONFIG): FirebaseApp {
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return name === '[DEFAULT]' ? initializeApp(cfg) : initializeApp(cfg, name);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('email');
provider.addScope('profile');

const fbProvider = new FacebookAuthProvider();
fbProvider.addScope('public_profile');
fbProvider.addScope('email');

if (!configError) {
  try {
    // Keep [DEFAULT] app synced to the active host's authorized Firebase project
    const defaultCfg = preferOgVelocityInitially ? OG_VELOCITY_FIREBASE_CONFIG : APPLET_FIREBASE_CONFIG;
    const secondaryCfg = preferOgVelocityInitially ? APPLET_FIREBASE_CONFIG : OG_VELOCITY_FIREBASE_CONFIG;

    const defaultApp = getApps().length ? getApp() : initNamedApp('[DEFAULT]', defaultCfg);
    const secondaryApp = initNamedApp('ogv-secondary', secondaryCfg);

    ogApp = preferOgVelocityInitially ? defaultApp : secondaryApp;
    appletApp = preferOgVelocityInitially ? secondaryApp : defaultApp;

    ogAuthInstance = getAuth(ogApp);
    ogAuthInstance.useDeviceLanguage();

    appletAuthInstance = getAuth(appletApp);
    appletAuthInstance.useDeviceLanguage();

    authInstance = preferOgVelocityInitially ? ogAuthInstance : appletAuthInstance;
    activeProjectId = authInstance.app.options.projectId || activeProjectId;

    // Firestore always connects to the provisioned AI Studio Firestore database ID
    dbInstance = APPLET_FIREBASE_CONFIG.firestoreDatabaseId
      ? getFirestore(appletApp, APPLET_FIREBASE_CONFIG.firestoreDatabaseId)
      : getFirestore(appletApp);

    persistenceReady = Promise.all([
      configureAuthPersistence(ogAuthInstance),
      configureAuthPersistence(appletAuthInstance),
    ]).then(() => undefined);

    if (typeof window !== 'undefined' && dbInstance) {
      const firestoreRef = dbInstance;
      void (async function testConnection() {
        try {
          await getDocFromServer(doc(firestoreRef, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error('Please check your Firebase configuration (Firestore client is offline).');
          }
        }
      })();
    }
  } catch (err) {
    configError =
      err instanceof Error
        ? `Invalid Firebase configuration: ${err.message}`
        : 'Invalid Firebase configuration.';
  }
}

export function getActiveAuth(): Auth | null {
  return authInstance;
}

export function getActiveAuthProjectId(): string {
  return activeProjectId;
}

export function getAllAuthInstances(): Auth[] {
  const list: Auth[] = [];
  if (authInstance) list.push(authInstance);
  if (ogAuthInstance && ogAuthInstance !== authInstance) list.push(ogAuthInstance);
  if (appletAuthInstance && appletAuthInstance !== authInstance) list.push(appletAuthInstance);
  return list;
}

export function isFirestoreActiveForAuth(): boolean {
  return Boolean(
    dbInstance &&
      appletAuthInstance?.currentUser &&
      appletAuthInstance.currentUser.emailVerified
  );
}

export async function resolveAuthForCurrentDomain(): Promise<{
  auth: Auth | null;
  projectId: string;
  isDomainAuthorized: boolean;
  currentHost: string;
}> {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  try {
    const resp = await fetch('/api/auth/domain-check');
    if (resp.ok) {
      const data = (await resp.json()) as {
        preferredProjectId?: string;
        isDomainAuthorized?: boolean;
        authorizedProjects?: string[];
      };
      const authorizedProjects = Array.isArray(data.authorizedProjects) ? data.authorizedProjects : [];
      if (authorizedProjects.includes(OG_VELOCITY_FIREBASE_CONFIG.projectId) && ogAuthInstance) {
        authInstance = ogAuthInstance;
        activeProjectId = OG_VELOCITY_FIREBASE_CONFIG.projectId;
        return {
          auth: authInstance,
          projectId: activeProjectId,
          isDomainAuthorized: true,
          currentHost,
        };
      }
      if (authorizedProjects.includes(APPLET_FIREBASE_CONFIG.projectId) && appletAuthInstance) {
        authInstance = appletAuthInstance;
        activeProjectId = APPLET_FIREBASE_CONFIG.projectId;
        return {
          auth: authInstance,
          projectId: activeProjectId,
          isDomainAuthorized: true,
          currentHost,
        };
      }
      if (typeof data.isDomainAuthorized === 'boolean' && !data.isDomainAuthorized) {
        return {
          auth: authInstance,
          projectId: activeProjectId,
          isDomainAuthorized: false,
          currentHost,
        };
      }
    }
  } catch {
    // Fallback to hostname-selected Auth instance
  }
  return {
    auth: authInstance,
    projectId: activeProjectId,
    isDomainAuthorized: Boolean(authInstance),
    currentHost,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const activeUser = appletAuthInstance?.currentUser || authInstance?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeUser?.uid ?? null,
      email: activeUser?.email ?? null,
      emailVerified: activeUser?.emailVerified ?? null,
      isAnonymous: activeUser?.isAnonymous ?? null,
      tenantId: activeUser?.tenantId ?? null,
      providerInfo:
        activeUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const auth = authInstance;
export const appletAuth = appletAuthInstance;
export const googleProvider = provider;
export const facebookProvider = fbProvider;
export const db = dbInstance;
export const firebaseConfigError = configError;
export const firebasePersistenceReady = persistenceReady;

export default appletApp || ogApp;
