import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface FirestoreEmulator {
  host: string;
  port: number;
}

/**
 * La configuración web de Firebase no es secreta (la protegen las reglas de seguridad), pero va en
 * variables de entorno para poder apuntar a otro proyecto sin tocar código. Las lecturas son
 * literales porque Next solo sustituye `process.env.NEXT_PUBLIC_*` escrito tal cual.
 */
export function firebaseConfigFromEnv(): FirebaseConfig {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Falta la configuración de Firebase: ${missing.join(", ")} (ver .env.example)`);
  }
  return config as FirebaseConfig;
}

/**
 * Firestore de una app con nombre. `ignoreUndefinedProperties`: el dominio no escribe `undefined`,
 * pero un campo opcional que llegara así no debe tumbar una escritura entera.
 */
export function createFirestore(
  config: Pick<FirebaseConfig, "projectId"> & Partial<FirebaseConfig>,
  options: { appName?: string; emulator?: FirestoreEmulator } = {},
): Firestore {
  const appName = options.appName ?? "[DEFAULT]";
  const existing = getApps().some((app) => app.name === appName);
  const app = existing ? getApp(appName) : initializeApp(config, appName);
  const db = existing
    ? getFirestore(app)
    : initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (options.emulator && !existing) {
    connectFirestoreEmulator(db, options.emulator.host, options.emulator.port);
  }
  return db;
}
