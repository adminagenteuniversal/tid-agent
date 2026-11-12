/**
 * PANEL ADMINISTRADOR DE IDENTIDADES Y CEREBRO EN FIREBASE
 * Gestiona los 'rostros' del agente:
 * - Seudónimo (Nombre)
 * - Profesión/Carrera (Terapeuta, Coach, Consultor, Maestro, Instructor, Consejero)
 * - Voz Humana (6 Registros: Bajo, Barítono, Tenor, Contralto, Mezzosoprano, Soprano)
 * - Barra de Adaptación de Registro (-10 a +10 semitones)
 * - Imagen de Perfil (Avatar)
 * - Imagen de Portada (Página de perfil del agente)
 * - Comportamiento & Personalidad
 * - Habilidades dinámicas
 * - Ecosistema de invocación (Web, Web App, APK, etc.)
 * - Sincronización inmediata con Firestore colección 'identidades'
 */

import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot 
} from "./firebase-config.js";
import { VOCAL_REGISTERS, voiceEngine } from "./voice-engine.js";

// Identidades maestras iniciales (Semilla de referencia)
export const DEFAULT_IDENTITIES = [
  {
    id: "dra-sofia-terapeuta",
    nombre: "Dra. Sofía Valenzuela",
    genero: "femenino",
    profesion: "Terapeuta",
    registroVocal: "Contralto",
    barraAdaptacion: 0,
    velocidad: 0.95,
    imagenPerfil: "https://images.unsplash.com/photo-1594824813515-5645d9472e61?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "Portal Web Salud & Bienestar",
    comportamiento: "Acompañante terapéutica y consejera compasiva. Diálogo pausado, reconfortante, validación emocional y ejercicios de respiración para calmar el estrés.",
    habilidades: ["Escucha activa", "Gestión de ansiedad y estrés", "Primeros auxilios emocionales", "Respiración guiada"],
    activo: true
  },
  {
    id: "lic-mateo-coach",
    nombre: "Lic. Mateo Vega",
    genero: "masculino",
    profesion: "Coach",
    registroVocal: "Barítono",
    barraAdaptacion: -2,
    velocidad: 1.02,
    imagenPerfil: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "App Móvil APK / Web Corporativa",
    comportamiento: "Coach de alto rendimiento y liderazgo personal. Enfoque constructivo, orientado a metas claras, preguntas reflexivas y eliminación de bloqueos.",
    habilidades: ["Fijación de metas SMART", "Gestión del tiempo", "Liderazgo personal", "Mentalidad de crecimiento"],
    activo: true
  },
  {
    id: "prof-gabriel-maestro",
    nombre: "Prof. Gabriel Morales",
    genero: "masculino",
    profesion: "Maestro",
    registroVocal: "Tenor",
    barraAdaptacion: 1,
    velocidad: 1.0,
    imagenPerfil: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "Campus Virtual & Academia Online",
    comportamiento: "Educador y pedagogo. Explica materias complejas con sencillez, analogías didácticas y paciencia. Fomenta el pensamiento crítico.",
    habilidades: ["Didáctica personalizada", "Técnicas mnemotécnicas", "Resolución paso a paso", "Orientación vocacional"],
    activo: true
  },
  {
    id: "dra-valentina-consultora",
    nombre: "Dra. Valentina Montes",
    genero: "femenino",
    profesion: "Consultor",
    registroVocal: "Mezzosoprano",
    barraAdaptacion: 2,
    velocidad: 1.05,
    imagenPerfil: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "Plataforma de Negocios & Emprendimiento",
    comportamiento: "Consultora senior de negocios y optimización de proyectos. Formulación estratégica precisa, rigor analítico y recomendaciones prácticas.",
    habilidades: ["Modelos de negocio", "Optimización de procesos", "Diagnóstico empresarial", "Estrategia de crecimiento"],
    activo: true
  },
  {
    id: "maestro-leonardo-instructor",
    nombre: "Maestro Leonardo Silva",
    genero: "masculino",
    profesion: "Instructor",
    registroVocal: "Bajo",
    barraAdaptacion: -4,
    velocidad: 0.88,
    imagenPerfil: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "App Móvil APK Mindfulness",
    comportamiento: "Instructor de meditación, respiración holística y reducción del estrés. Tono bajo y cadencioso, atmósfera de profunda paz.",
    habilidades: ["Mindfulness guiado", "Visualización creativa", "Higiene del sueño", "Paz interior"],
    activo: true
  },
  {
    id: "aura-consejera-soprano",
    nombre: "Aura Inteligente",
    genero: "femenino",
    profesion: "Consejero",
    registroVocal: "Soprano",
    barraAdaptacion: 3,
    velocidad: 1.02,
    imagenPerfil: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "Asistente Virtual Global Multi-Plataforma",
    comportamiento: "Asistente conversacional rápida, lúcida, entusiasta y amable tipo Siri/Alexa. Soluciona dudas generales y acompaña en tareas cotidianas.",
    habilidades: ["Atención al visitante 24/7", "Navegación asistida", "Resolución de consultas", "Empatía digital"],
    activo: true
  }
];

class AdminPanel {
  constructor() {
    this.localKey = "tid_identities_storage";
    this.identities = [];
    this.activeIdentityId = null;
    this.unsubscribeFirestore = null;
  }

  async loadIdentities() {
    // 1. Cargar almacenamiento local primero
    try {
      const stored = localStorage.getItem(this.localKey);
      if (stored) {
        this.identities = JSON.parse(stored);
      } else {
        this.identities = [...DEFAULT_IDENTITIES];
        this.saveToLocal();
      }
    } catch {
      this.identities = [...DEFAULT_IDENTITIES];
    }

    if (!this.activeIdentityId && this.identities.length > 0) {
      this.activeIdentityId = this.identities[0].id;
    }

    // 2. Si Firestore está conectado, sincronizar en tiempo real
    if (db) {
      try {
        const colRef = collection(db, "identidades");
        const snap = await getDocs(colRef);
        if (snap.empty) {
          // Sembrar identidades iniciales en Firestore si la colección está vacía
          for (const item of this.identities) {
            await setDoc(doc(db, "identidades", item.id), item);
          }
          console.log("Colección 'identidades' sembrada exitosamente en Firebase Firestore");
        } else {
          const list = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          this.identities = list;
          this.saveToLocal();
        }

        // Suscripción en tiempo real
        this.unsubscribeFirestore = onSnapshot(colRef, (snapshot) => {
          const updated = [];
          snapshot.forEach(d => updated.push({ id: d.id, ...d.data() }));
          if (updated.length > 0) {
            this.identities = updated;
            this.saveToLocal();
            this.notifyListeners();
          }
        });
      } catch (err) {
        console.warn("No se pudo conectar a la colección 'identidades' en Firestore:", err);
      }
    }

    return this.identities;
  }

  saveToLocal() {
    localStorage.setItem(this.localKey, JSON.stringify(this.identities));
  }

  getActiveIdentity() {
    return this.identities.find(i => i.id === this.activeIdentityId) || this.identities[0] || DEFAULT_IDENTITIES[0];
  }

  setActiveIdentity(id) {
    this.activeIdentityId = id;
    this.notifyListeners();
  }

  /**
   * Guarda o actualiza una identidad inmediatamente en Firestore y Local
   */
  async saveIdentity(identityData) {
    const id = identityData.id || ("agente-" + Date.now());
    const completeData = {
      ...identityData,
      id: id,
      actualizadoEn: new Date().toISOString()
    };

    // Actualizar array en memoria
    const index = this.identities.findIndex(i => i.id === id);
    if (index >= 0) {
      this.identities[index] = completeData;
    } else {
      this.identities.push(completeData);
    }

    this.saveToLocal();

    // Actualizar inmediatamente en Firestore
    if (db) {
      try {
        await setDoc(doc(db, "identidades", id), completeData);
        console.log("Identidad guardada en Firestore:", id);
      } catch (err) {
        console.error("Error al persistir en Firestore:", err);
        throw err;
      }
    }

    this.notifyListeners();
    return completeData;
  }

  /**
   * Fuerza la sincronización y creación de todas las identidades en Firestore
   */
  async syncAllToFirebase() {
    if (!db) {
      throw new Error("No hay conexión con Firestore. Verifica que hayas configurado tu Web API Key en Ajustes.");
    }
    const results = [];
    for (const ident of this.identities) {
      await setDoc(doc(db, "identidades", ident.id), {
        ...ident,
        actualizadoEn: new Date().toISOString()
      });
      results.push(ident.nombre);
    }
    return results;
  }

  /**
   * Elimina una identidad
   */
  async deleteIdentity(id) {
    this.identities = this.identities.filter(i => i.id !== id);
    this.saveToLocal();

    if (this.activeIdentityId === id && this.identities.length > 0) {
      this.activeIdentityId = this.identities[0].id;
    }

    if (db) {
      try {
        await deleteDoc(doc(db, "identidades", id));
      } catch (err) {
        console.warn("Error al borrar en Firestore:", err);
      }
    }

    this.notifyListeners();
  }

  /**
   * Prueba en vivo la voz con el registro vocal y la barra de adaptación seleccionada
   */
  testVoiceSample(registro, barraAdaptacion, velocidad, textoMuestra = null) {
    const sample = textoMuestra || `Hola, soy tu asistente con registro ${registro}. Mi voz está calibrada para acompañarte con gentileza en cualquier momento.`;
    voiceEngine.speak(sample, {
      registro: registro,
      barraAdaptacion: Number(barraAdaptacion),
      velocidad: Number(velocidad)
    });
  }

  onUpdate(callback) {
    this.updateCallback = callback;
  }

  notifyListeners() {
    if (this.updateCallback) {
      this.updateCallback(this.identities, this.getActiveIdentity());
    }
  }
}

export const adminPanel = new AdminPanel();
