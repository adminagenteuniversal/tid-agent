// Firebase Modular Web SDK (v10.13.0)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Configuración de Firebase para el proyecto 'tid-agent'
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: localStorage.getItem("tid_firebase_api_key") || "",
  authDomain: "tid-agent.firebaseapp.com",
  projectId: "tid-agent",
  storageBucket: "tid-agent.firebasestorage.app",
  messagingSenderId: "838989599692",
  appId: "1:838989599692:web:0194cf58e8983ab3654369"
};

let app = null;
let auth = null;
let db = null;
let isFirebaseConnected = false;

// Inicialización de Firebase
export function initFirebase(customConfig = null) {
  const config = customConfig || {
    ...DEFAULT_FIREBASE_CONFIG,
    apiKey: localStorage.getItem("tid_firebase_api_key") || DEFAULT_FIREBASE_CONFIG.apiKey
  };

  try {
    if (config.apiKey && config.apiKey.trim().length > 10) {
      if (!getApps().length) {
        app = initializeApp(config);
      } else {
        app = getApp();
      }
      auth = getAuth(app);
      db = getFirestore(app);
      setPersistence(auth, browserLocalPersistence).catch(console.warn);
      isFirebaseConnected = true;
      console.log("Firebase inicializado exitosamente para el proyecto:", config.projectId);
      return { app, auth, db, isConnected: true };
    } else {
      console.warn("Firebase no tiene API Key configurada. Modo offline/demostración activo.");
      isFirebaseConnected = false;
      return { app: null, auth: null, db: null, isConnected: false };
    }
  } catch (err) {
    console.error("Error al inicializar Firebase:", err);
    isFirebaseConnected = false;
    return { app: null, auth: null, db: null, isConnected: false, error: err };
  }
}

// Iniciar sesión con Google Sign-In
export async function loginWithGoogle() {
  if (!auth) {
    const initRes = initFirebase();
    if (!initRes.isConnected) {
      throw new Error("Configura tu Web API Key de Firebase en Ajustes para activar Google Sign-In.");
    }
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// Cerrar sesión
export async function logoutUser() {
  if (auth) {
    await fbSignOut(auth);
  }
}

// Escuchar cambios de autenticación
export function onAuthStatusChanged(callback) {
  if (auth) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Si no hay Firebase activo, emitir usuario nulo
    callback(null);
    return () => {};
  }
}

// Guardar API Key y re-inicializar
export function saveApiKey(apiKey) {
  localStorage.setItem("tid_firebase_api_key", apiKey.trim());
  return initFirebase();
}

export function getFirebaseStatus() {
  return {
    isConnected: isFirebaseConnected,
    projectId: DEFAULT_FIREBASE_CONFIG.projectId,
    appId: DEFAULT_FIREBASE_CONFIG.appId,
    hasApiKey: !!(localStorage.getItem("tid_firebase_api_key"))
  };
}

export { 
  app, 
  auth, 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
};
