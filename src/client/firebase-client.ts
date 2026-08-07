"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Sin NEXT_PUBLIC_FIREBASE_API_KEY (entorno local sin credenciales reales
// todavía, ver README) initializeApp/getAuth tiran y rompen el SSR de
// cualquier página que use AuthProvider. auth queda null en ese caso.
export const firebaseApp = firebaseConfig.apiKey
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
