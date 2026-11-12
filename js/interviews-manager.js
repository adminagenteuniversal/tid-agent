/**
 * GESTOR DE ENTREVISTAS, EXPEDIENTES Y SEGUIMIENTOS
 * Colección Firestore: 'entrevistas'
 * 
 * Requisitos del usuario:
 * - Cada sesión debe almacenarse en una colección correspondiente a las entrevistas.
 * - Con campos denominados según el número de registro de cada usuario (número de expediente).
 * - Actualizándose con número de seguimiento diferente por entrevista para diferenciar las fechas de actividad.
 * - Registro de objetivos y resultados.
 */

import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "./firebase-config.js";
import { GREETING_PHRASE, FAREWELL_PHRASE } from "./conversation-brain.js";

class InterviewsManager {
  constructor() {
    this.localKey = "tid_cached_entrevistas";
  }

  /**
   * Genera o recupera el número de registro / expediente único del usuario.
   * Basado en su UID o identificador permanente.
   */
  getUserExpedienteNumber(user) {
    if (!user) {
      return "EXP-VISITANTE-" + Math.floor(1000 + Math.random() * 9000);
    }
    const cleanUid = (user.uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    return `EXP-TID-${cleanUid || "USER"}`;
  }

  /**
   * Genera un número de seguimiento único para la entrevista actual
   * Formato: SEG-YYYYMMDD-XXXX (diferencia fechas y sesiones)
   */
  generateTrackingNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `SEG-${yyyy}${mm}${dd}-${randomSuffix}`;
  }

  /**
   * Guarda la sesión completa de entrevista en Firestore y en caché local
   */
  async saveInterviewSession(sessionData) {
    const {
      user,
      identity,
      messages,
      startTime,
      endTime = new Date(),
      objetivos = "Orientación general y resolución de dudas",
      resultados = "Sesión finalizada exitosamente"
    } = sessionData;

    const numeroExpediente = this.getUserExpedienteNumber(user);
    const numeroSeguimiento = this.generateTrackingNumber();
    const duracionSegundos = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

    const interviewDoc = {
      numeroExpediente: numeroExpediente,
      numeroSeguimiento: numeroSeguimiento,
      usuarioId: user ? user.uid : "anonimo",
      usuarioNombre: user ? (user.displayName || "Usuario Registrado") : "Visitante Anónimo",
      usuarioEmail: user ? (user.email || "") : "",
      identidadId: identity ? identity.id : "agente-general",
      identidadNombre: identity ? identity.nombre : "Agente TID",
      profesion: identity ? identity.profesion : "Consejero",
      ecosistema: identity ? (identity.ecosistema || "Sitio Web Principal") : "Sitio Web",
      registroVocal: identity ? identity.registroVocal : "Barítono",
      fechaActividad: new Date().toISOString(),
      fechaInicio: startTime.toISOString(),
      fechaFin: endTime.toISOString(),
      duracionSegundos: duracionSegundos,
      fraseInicio: GREETING_PHRASE,
      fraseDespedida: FAREWELL_PHRASE,
      mensajes: messages.map(m => ({
        emisor: m.emisor,
        texto: m.texto,
        timestamp: m.timestamp || new Date().toISOString()
      })),
      objetivos: objetivos,
      resultados: resultados,
      estado: "completada",
      creadoEnTimestamp: Date.now()
    };

    // 1. Guardar en almacenamiento local como respaldo inmediato
    this.saveToLocalStorage(interviewDoc);

    // 2. Guardar en Firestore si la base de datos está disponible
    if (db) {
      try {
        const docRef = await addDoc(collection(db, "entrevistas"), {
          ...interviewDoc,
          serverCreatedAt: serverTimestamp()
        });
        console.log("Entrevista guardada exitosamente en Firestore con ID:", docRef.id);
        interviewDoc.firestoreId = docRef.id;
      } catch (err) {
        console.warn("No se pudo escribir en Firestore (posible falta de permisos o conexión). Guardada localmente.", err);
        interviewDoc.firestoreError = err.message || String(err);
      }
    }

    return interviewDoc;
  }

  saveToLocalStorage(interview) {
    const list = this.getLocalInterviews();
    list.unshift(interview);
    localStorage.setItem(this.localKey, JSON.stringify(list.slice(0, 100)));
  }

  getLocalInterviews() {
    try {
      const data = localStorage.getItem(this.localKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Obtiene todas las entrevistas (desde Firestore con fallback a local)
   */
  async getAllInterviews(userId = null) {
    if (db) {
      try {
        const colRef = collection(db, "entrevistas");
        let q;
        if (userId) {
          q = query(colRef, where("usuarioId", "==", userId), orderBy("fechaActividad", "desc"));
        } else {
          q = query(colRef, orderBy("fechaActividad", "desc"));
        }
        const snap = await getDocs(q);
        const results = [];
        snap.forEach(doc => {
          results.push({ firestoreId: doc.id, ...doc.data() });
        });
        if (results.length > 0) return results;
      } catch (err) {
        console.warn("Fallo al leer de Firestore, utilizando datos en caché local:", err);
      }
    }
    const local = this.getLocalInterviews();
    if (userId) {
      return local.filter(i => i.usuarioId === userId);
    }
    return local;
  }
}

export const interviewsManager = new InterviewsManager();
