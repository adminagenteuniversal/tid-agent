/**
 * CONTROLADOR PRINCIPAL DE TID-AGENT
 * Orquesta la interfaz, la autenticación de Google, el panel administrador,
 * el bucle conversacional y la persistencia en Firebase Firestore.
 */

import { 
  initFirebase, 
  loginWithGoogle, 
  logoutUser, 
  onAuthStatusChanged, 
  getFirebaseStatus, 
  saveApiKey 
} from "./firebase-config.js";
import { VOCAL_REGISTERS, voiceEngine } from "./voice-engine.js";
import { speechManager } from "./speech-recognition.js";
import { conversationBrain, GREETING_PHRASE, FAREWELL_PHRASE } from "./conversation-brain.js";
import { adminPanel } from "./admin-panel.js";
import { interviewsManager } from "./interviews-manager.js";
import { statsManager } from "./stats-manager.js";

// Estado de la aplicación
const state = {
  currentUser: null,
  activeTab: "conversacion", // 'conversacion' | 'admin' | 'expedientes' | 'estadisticas'
  activeIdentity: null,
  isSessionActive: false,
  sessionStartTime: null,
  sessionMessages: [],
  selectedAdminIdentityId: null,
  firebaseStatus: getFirebaseStatus()
};

// Elementos DOM principales
let canvasVisualizer, ctxVisualizer;

// Inicialización de la aplicación al cargar el DOM
window.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupVisualizer();
  setupAuth();
  setupSettingsModal();
  
  // Inicializar Firebase
  initFirebase();
  state.firebaseStatus = getFirebaseStatus();
  updateFirebaseStatusBadge();

  // Cargar identidades del Cerebro Central
  await adminPanel.loadIdentities();
  state.activeIdentity = adminPanel.getActiveIdentity();
  state.selectedAdminIdentityId = state.activeIdentity?.id;

  adminPanel.onUpdate((identities, active) => {
    state.activeIdentity = active;
    renderIdentitySelectorHeader();
    renderConversationalProfileCard();
    renderAdminIdentityList();
    renderAdminForm(state.selectedAdminIdentityId);
  });

  renderIdentitySelectorHeader();
  renderConversationalProfileCard();
  renderAdminIdentityList();
  renderAdminForm(state.selectedAdminIdentityId);

  setupConversationalEvents();
  setupAdminEvents();
  loadInterviewsView();
  loadStatsView();
});

// ==========================================
// PESTAÑAS Y NAVEGACIÓN
// ==========================================
function setupTabs() {
  const tabButtons = document.querySelectorAll("[data-tab-target]");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab-target");
      switchTab(target);
    });
  });
}

export function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll("[data-tab-target]").forEach(b => {
    if (b.getAttribute("data-tab-target") === tabId) {
      b.classList.add("active-tab");
    } else {
      b.classList.remove("active-tab");
    }
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    if (view.id === `tab-${tabId}`) {
      view.classList.remove("hidden");
    } else {
      view.classList.add("hidden");
    }
  });

  if (tabId === "expedientes") {
    loadInterviewsView();
  } else if (tabId === "estadisticas") {
    loadStatsView();
  }
}

// ==========================================
// AUTENTICACIÓN GOOGLE SIGN-IN
// ==========================================
function setupAuth() {
  const btnLogin = document.getElementById("btn-google-login");
  const btnLogout = document.getElementById("btn-logout");

  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      try {
        if (!state.firebaseStatus.hasApiKey) {
          openSettingsModal();
          alert("Por favor ingresa tu Firebase Web API Key para completar el inicio de sesión con Google.");
          return;
        }
        btnLogin.innerHTML = `<span class="spinner"></span> Conectando...`;
        const user = await loginWithGoogle();
        state.currentUser = user;
        renderUserInterface();
      } catch (err) {
        console.error("Error al iniciar sesión con Google:", err);
        alert("Error de autenticación Google: " + (err.message || err));
      } finally {
        btnLogin.innerHTML = `<span>G</span> Iniciar con Google`;
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await logoutUser();
      state.currentUser = null;
      renderUserInterface();
    });
  }

  // Escuchar cambios de estado en Firebase Auth
  onAuthStatusChanged((user) => {
    state.currentUser = user;
    renderUserInterface();
  });
}

function renderUserInterface() {
  const authLoggedOut = document.getElementById("auth-logged-out");
  const authLoggedIn = document.getElementById("auth-logged-in");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const userExpediente = document.getElementById("user-expediente");

  if (state.currentUser) {
    if (authLoggedOut) authLoggedOut.classList.add("hidden");
    if (authLoggedIn) authLoggedIn.classList.remove("hidden");
    if (userAvatar) userAvatar.src = state.currentUser.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(state.currentUser.displayName || "Usuario");
    if (userName) userName.textContent = state.currentUser.displayName || state.currentUser.email || "Usuario";
    if (userExpediente) {
      userExpediente.textContent = interviewsManager.getUserExpedienteNumber(state.currentUser);
    }
  } else {
    if (authLoggedOut) authLoggedOut.classList.remove("hidden");
    if (authLoggedIn) authLoggedIn.classList.add("hidden");
  }
}

// ==========================================
// MODO CONVERSACIONAL (ALEXA / SIRI / JARVIS)
// ==========================================
function setupConversationalEvents() {
  const btnStartSession = document.getElementById("btn-start-session");
  const btnMic = document.getElementById("btn-mic-toggle");
  const btnEndSession = document.getElementById("btn-end-session");
  const chatForm = document.getElementById("chat-input-form");
  const textInput = document.getElementById("chat-text-input");

  // Iniciar Sesión Conversacional
  if (btnStartSession) {
    btnStartSession.addEventListener("click", () => {
      startNewSession();
    });
  }

  // Botón Micrófono
  if (btnMic) {
    btnMic.addEventListener("click", async () => {
      if (!state.isSessionActive) {
        await startNewSession();
      }
      toggleMicrophone();
    });
  }

  // Finalizar Sesión
  if (btnEndSession) {
    btnEndSession.addEventListener("click", () => {
      finishSessionWithFarewell();
    });
  }

  // Envío manual por texto
  if (chatForm && textInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = textInput.value.trim();
      if (!text) return;
      textInput.value = "";
      if (!state.isSessionActive) {
        startNewSession(false);
      }
      handleUserTurn(text);
    });
  }

  // Configurar callbacks del reconocedor de voz
  speechManager.setResultCallback(({ final, interim }) => {
    const liveTranscript = document.getElementById("live-speech-feedback");
    if (liveTranscript) {
      liveTranscript.textContent = interim || final || "";
    }
    if (final) {
      handleUserTurn(final);
      if (liveTranscript) liveTranscript.textContent = "";
    }
  });

  speechManager.setStatusCallback((status, error) => {
    const micStatusPill = document.getElementById("mic-status-indicator");
    const micBtn = document.getElementById("btn-mic-toggle");
    if (status === "escuchando") {
      if (micStatusPill) micStatusPill.textContent = "Escuchando...";
      if (micBtn) micBtn.classList.add("recording-pulse");
    } else {
      if (micStatusPill) micStatusPill.textContent = "Micrófono en espera";
      if (micBtn) micBtn.classList.remove("recording-pulse");
    }
  });
}

async function startNewSession(speakGreeting = true) {
  state.isSessionActive = true;
  state.sessionStartTime = new Date();
  state.sessionMessages = [];

  const chatContainer = document.getElementById("chat-messages-container");
  if (chatContainer) chatContainer.innerHTML = "";

  const emptyState = document.getElementById("conversational-empty-state");
  const activeState = document.getElementById("conversational-active-state");
  if (emptyState) emptyState.classList.add("hidden");
  if (activeState) activeState.classList.remove("hidden");

  // Frase inicial obligatoria: "Hola, ¿cómo puedo ayudarte?"
  appendMessage("agente", GREETING_PHRASE);

  if (speakGreeting) {
    const ident = state.activeIdentity;
    voiceEngine.speak(GREETING_PHRASE, {
      registro: ident.registroVocal,
      barraAdaptacion: ident.barraAdaptacion,
      velocidad: ident.velocidad,
      onEnd: () => {
        // Al terminar de hablar el saludo, abrir automáticamente el micrófono para un flujo fluido
        speechManager.startListening().catch(console.warn);
      }
    });
  }
}

async function handleUserTurn(userText) {
  if (!userText || !userText.trim()) return;

  speechManager.stopListening();
  appendMessage("usuario", userText);

  const ident = state.activeIdentity;
  const statusIndicator = document.getElementById("agent-status-indicator");
  if (statusIndicator) statusIndicator.textContent = `${ident.nombre} está pensando...`;

  try {
    const result = await conversationBrain.generateResponse(userText, state.sessionMessages, ident);
    
    appendMessage("agente", result.text);
    if (statusIndicator) statusIndicator.textContent = `${ident.nombre} hablando...`;

    // Reproducir la respuesta con el motor de voz calibrado
    voiceEngine.speak(result.text, {
      registro: ident.registroVocal,
      barraAdaptacion: ident.barraAdaptacion,
      velocidad: ident.velocidad,
      onEnd: async () => {
        if (statusIndicator) statusIndicator.textContent = "Listo para escucharte";
        if (result.isFarewell) {
          // Si era despedida, cerrar la sesión y persistir en Firebase
          await finalizeAndSaveSession(result.detectedObjectives, result.detectedResults);
        } else {
          // Continuar la conversación natural
          speechManager.startListening().catch(console.warn);
        }
      }
    });

  } catch (err) {
    console.error("Error al procesar turno conversacional:", err);
    appendMessage("agente", "Disculpa, he tenido una pequeña interrupción, pero sigo aquí para apoyarte.");
  }
}

async function toggleMicrophone() {
  if (speechManager.isListening) {
    speechManager.stopListening();
  } else {
    try {
      await speechManager.startListening();
    } catch (err) {
      alert("No se pudo activar el micrófono: " + err.message);
    }
  }
}

async function finishSessionWithFarewell() {
  const ident = state.activeIdentity;
  appendMessage("agente", FAREWELL_PHRASE);
  
  voiceEngine.speak(FAREWELL_PHRASE, {
    registro: ident.registroVocal,
    barraAdaptacion: ident.barraAdaptacion,
    velocidad: ident.velocidad,
    onEnd: async () => {
      await finalizeAndSaveSession();
    }
  });
}

async function finalizeAndSaveSession(objetivos = null, resultados = null) {
  state.isSessionActive = false;
  speechManager.stopListening();

  const sessionData = {
    user: state.currentUser,
    identity: state.activeIdentity,
    messages: state.sessionMessages,
    startTime: state.sessionStartTime || new Date(),
    endTime: new Date(),
    objetivos: objetivos || conversationBrain.extractObjectives(state.sessionMessages, ""),
    resultados: resultados || conversationBrain.extractResults(state.sessionMessages, "", state.activeIdentity)
  };

  const savedRecord = await interviewsManager.saveInterviewSession(sessionData);

  // Mostrar aviso de guardado con el expediente y seguimiento
  if (savedRecord.firestoreError) {
    alert(`Sesión finalizada.
• Número de Expediente: ${savedRecord.numeroExpediente}
• Número de Seguimiento: ${savedRecord.numeroSeguimiento}
• Guardada en memoria local.
⚠️ Aviso Firestore: ${savedRecord.firestoreError}
(Verifica que la base de datos Firestore esté creada en Firebase Console y sus reglas permitan escritura).`);
  } else {
    alert(`✅ ¡Sesión guardada exitosamente en Cloud Firestore!
• Colección: 'entrevistas'
• Documento ID: ${savedRecord.firestoreId || 'generado'}
• Número de Expediente: ${savedRecord.numeroExpediente}
• Número de Seguimiento: ${savedRecord.numeroSeguimiento}
• Objetivos: ${savedRecord.objetivos}`);
  }

  const emptyState = document.getElementById("conversational-empty-state");
  const activeState = document.getElementById("conversational-active-state");
  if (emptyState) emptyState.classList.remove("hidden");
  if (activeState) activeState.classList.add("hidden");

  loadInterviewsView();
  loadStatsView();
}

function appendMessage(sender, text) {
  const chatContainer = document.getElementById("chat-messages-container");
  const msgObj = {
    emisor: sender,
    texto: text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  state.sessionMessages.push(msgObj);

  if (chatContainer) {
    const isAgent = sender === "agente";
    const bubble = document.createElement("div");
    bubble.className = `flex gap-3 mb-4 ${isAgent ? 'justify-start' : 'justify-end'}`;
    bubble.innerHTML = `
      ${isAgent ? `<img src="${state.activeIdentity.imagenPerfil}" class="w-8 h-8 rounded-full object-cover border border-cyan-400">` : ''}
      <div class="max-w-[75%] rounded-2xl p-4 shadow-md ${isAgent ? 'bg-slate-800/90 text-slate-100 border border-slate-700' : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'}">
        <div class="text-xs font-semibold opacity-75 mb-1">${isAgent ? state.activeIdentity.nombre : (state.currentUser?.displayName || 'Tú')} • ${msgObj.timestamp}</div>
        <div class="text-sm leading-relaxed">${escapeHtml(text)}</div>
      </div>
      ${!isAgent ? `<img src="${state.currentUser?.photoURL || 'https://ui-avatars.com/api/?name=User'}" class="w-8 h-8 rounded-full object-cover border border-blue-400">` : ''}
    `;
    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// ==========================================
// RENDERIZADO DEL PERFIL CONVERSACIONAL
// ==========================================
function renderIdentitySelectorHeader() {
  const container = document.getElementById("header-identity-selector");
  if (!container) return;

  const identities = adminPanel.identities;
  container.innerHTML = `
    <label class="text-xs font-semibold text-slate-400 mr-2">Identidad Activa:</label>
    <select id="select-global-identity" class="bg-slate-800 border border-slate-700 text-cyan-400 text-xs rounded-lg px-3 py-1.5 focus:ring-cyan-500">
      ${identities.map(i => `
        <option value="${i.id}" ${i.id === state.activeIdentity?.id ? 'selected' : ''}>
          ${i.nombre} (${i.profesion} • ${i.registroVocal})
        </option>
      `).join('')}
    </select>
  `;

  document.getElementById("select-global-identity")?.addEventListener("change", (e) => {
    adminPanel.setActiveIdentity(e.target.value);
  });
}

function renderConversationalProfileCard() {
  const ident = state.activeIdentity;
  if (!ident) return;

  const coverElem = document.getElementById("agent-cover-img");
  const avatarElem = document.getElementById("agent-avatar-img");
  const nameElem = document.getElementById("agent-name-display");
  const roleElem = document.getElementById("agent-role-display");
  const ecosystemBadge = document.getElementById("agent-ecosystem-badge");
  const registerBadge = document.getElementById("agent-register-badge");
  const behaviorElem = document.getElementById("agent-behavior-display");
  const skillsElem = document.getElementById("agent-skills-display");

  if (coverElem) coverElem.src = ident.imagenPortada || "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80";
  if (avatarElem) avatarElem.src = ident.imagenPerfil || "https://ui-avatars.com/api/?name=" + encodeURIComponent(ident.nombre);
  if (nameElem) nameElem.textContent = ident.nombre;
  if (roleElem) roleElem.textContent = ident.profesion;
  if (ecosystemBadge) ecosystemBadge.textContent = ident.ecosistema || "Web Principal";
  if (registerBadge) {
    const regData = VOCAL_REGISTERS[ident.registroVocal] || VOCAL_REGISTERS["Barítono"];
    registerBadge.textContent = `Registro: ${ident.registroVocal} (${regData.rangoHz}) [Adaptación: ${ident.barraAdaptacion > 0 ? '+' : ''}${ident.barraAdaptacion}]`;
  }
  if (behaviorElem) behaviorElem.textContent = ident.comportamiento;
  if (skillsElem) {
    skillsElem.innerHTML = (ident.habilidades || []).map(skill => `
      <span class="px-2.5 py-1 text-xs rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">${escapeHtml(skill)}</span>
    `).join('');
  }
}

// ==========================================
// PANEL ADMINISTRADOR (GESTIÓN DE ROSTROS Y VOZ)
// ==========================================
function setupAdminEvents() {
  const btnSyncAll = document.getElementById("btn-sync-all-firebase");
  const btnNewIdentity = document.getElementById("btn-new-identity");
  const adminForm = document.getElementById("admin-identity-form");
  const btnTestVoice = document.getElementById("btn-admin-test-voice");
  const adaptationSlider = document.getElementById("admin-adaptation-slider");
  const speedSlider = document.getElementById("admin-speed-slider");
  const avatarInput = document.getElementById("admin-avatar-url");
  const coverInput = document.getElementById("admin-cover-url");

  // Botón para sincronizar y crear todas las identidades en Firestore inmediatamente
  if (btnSyncAll) {
    btnSyncAll.addEventListener("click", async () => {
      btnSyncAll.innerHTML = `<span class="spinner"></span> Sincronizando...`;
      try {
        const synced = await adminPanel.syncAllToFirebase();
        alert(`✅ ¡Éxito! Colección 'identidades' creada y sincronizada en Firebase con ${synced.length} rostros:\n• ${synced.join('\n• ')}\n\nYa puedes refrescar tu Firebase Console para ver la colección y sus campos.`);
      } catch (err) {
        console.error("Error al sincronizar identidades a Firestore:", err);
        alert(`⚠️ No se pudo escribir en Firebase Firestore:
${err.message || err}

Pasos para resolverlo:
1. Asegúrate de haber presionado "Crear base de datos" en Firebase Console > Firestore Database.
2. En la pestaña 'Rules' de Firestore, permite temporalmente lectura y escritura (ej: 'allow read, write: if true;') o inicia sesión con Google.`);
      } finally {
        btnSyncAll.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          <span>Crear/Sincronizar en Firebase</span>
        `;
      }
    });
  }

  if (btnNewIdentity) {
    btnNewIdentity.addEventListener("click", () => {
      state.selectedAdminIdentityId = null;
      renderAdminForm(null);
    });
  }

  // Modificación en tiempo real de la barra de adaptación
  if (adaptationSlider) {
    adaptationSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      const display = document.getElementById("adaptation-value-display");
      if (display) display.textContent = `${val > 0 ? '+' : ''}${val} semitonos`;
    });
  }

  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      const display = document.getElementById("speed-value-display");
      if (display) display.textContent = `${val}x`;
    });
  }

  // Previsualizaciones de imágenes al escribir la URL
  if (avatarInput) {
    avatarInput.addEventListener("input", (e) => {
      const prev = document.getElementById("admin-avatar-preview");
      if (prev && e.target.value) prev.src = e.target.value;
    });
  }
  if (coverInput) {
    coverInput.addEventListener("input", (e) => {
      const prev = document.getElementById("admin-cover-preview");
      if (prev && e.target.value) prev.src = e.target.value;
    });
  }

  // Botón Probar Voz desde Admin
  if (btnTestVoice) {
    btnTestVoice.addEventListener("click", () => {
      const reg = document.querySelector("input[name='admin-voice-register']:checked")?.value || "Barítono";
      const adapt = document.getElementById("admin-adaptation-slider")?.value || 0;
      const speed = document.getElementById("admin-speed-slider")?.value || 1.0;
      const name = document.getElementById("admin-name")?.value || "Tu Asistente";
      const sampleText = `Hola, soy ${name}. Mi voz está configurada en registro ${reg} con ajuste tonal de ${adapt} semitonos.`;
      adminPanel.testVoiceSample(reg, adapt, speed, sampleText);
    });
  }

  // Guardado de identidad en Firestore
  if (adminForm) {
    adminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-save-identity");
      if (saveBtn) saveBtn.innerHTML = `<span class="spinner"></span> Guardando en Firebase...`;

      try {
        const skillsString = document.getElementById("admin-skills")?.value || "";
        const skillsArray = skillsString.split(",").map(s => s.trim()).filter(Boolean);

        const identityData = {
          id: state.selectedAdminIdentityId || ("agente-" + Date.now()),
          nombre: document.getElementById("admin-name")?.value.trim() || "Nuevo Agente",
          genero: document.getElementById("admin-gender")?.value || "masculino",
          profesion: document.getElementById("admin-profession")?.value || "Consejero",
          registroVocal: document.querySelector("input[name='admin-voice-register']:checked")?.value || "Barítono",
          barraAdaptacion: Number(document.getElementById("admin-adaptation-slider")?.value || 0),
          velocidad: Number(document.getElementById("admin-speed-slider")?.value || 1.0),
          imagenPerfil: document.getElementById("admin-avatar-url")?.value.trim() || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
          imagenPortada: document.getElementById("admin-cover-url")?.value.trim() || "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80",
          ecosistema: document.getElementById("admin-ecosystem")?.value.trim() || "Sitio Web Principal",
          comportamiento: document.getElementById("admin-behavior")?.value.trim() || "Empático, amable y profesional.",
          habilidades: skillsArray,
          activo: true
        };

        const saved = await adminPanel.saveIdentity(identityData);
        state.selectedAdminIdentityId = saved.id;
        state.activeIdentity = saved;

        alert(`¡Rostro e Identidad '${saved.nombre}' guardado exitosamente en Firebase Firestore (Colección 'identidades')!`);
      } catch (err) {
        alert("Error al guardar la identidad: " + err.message);
      } finally {
        if (saveBtn) saveBtn.innerHTML = `Guardar Identidad en Firebase`;
      }
    });
  }
}

function renderAdminIdentityList() {
  const container = document.getElementById("admin-identities-list");
  if (!container) return;

  const identities = adminPanel.identities;
  container.innerHTML = identities.map(i => {
    const isSelected = i.id === state.selectedAdminIdentityId;
    return `
      <div data-identity-id="${i.id}" class="admin-identity-item p-3 rounded-xl cursor-pointer transition border ${isSelected ? 'bg-cyan-950/60 border-cyan-500 shadow-lg' : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'}">
        <div class="flex items-center gap-3">
          <img src="${i.imagenPerfil}" class="w-10 h-10 rounded-full object-cover border border-slate-600">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-white truncate">${escapeHtml(i.nombre)}</h4>
            <p class="text-xs text-cyan-400 font-medium">${i.profesion} • <span class="text-slate-400">${i.registroVocal}</span></p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">${i.ecosistema?.split(' ')[0] || 'Web'}</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll("[data-identity-id]").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.getAttribute("data-identity-id");
      state.selectedAdminIdentityId = id;
      renderAdminIdentityList();
      renderAdminForm(id);
    });
  });
}

function renderAdminForm(identityId) {
  const formTitle = document.getElementById("admin-form-title");
  const ident = adminPanel.identities.find(i => i.id === identityId) || {
    id: "",
    nombre: "",
    genero: "femenino",
    profesion: "Terapeuta",
    registroVocal: "Contralto",
    barraAdaptacion: 0,
    velocidad: 1.0,
    imagenPerfil: "https://images.unsplash.com/photo-1594824813515-5645d9472e61?auto=format&fit=crop&w=400&q=80",
    imagenPortada: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80",
    ecosistema: "Sitio Web Principal",
    comportamiento: "Acompañante gentil, empático y reflexivo.",
    habilidades: ["Escucha activa", "Orientación", "Bienestar"],
    activo: true
  };

  if (formTitle) formTitle.textContent = identityId ? `Editando: ${ident.nombre}` : `Crear Nuevo Rostro / Identidad`;

  const nameInput = document.getElementById("admin-name");
  const genderInput = document.getElementById("admin-gender");
  const professionInput = document.getElementById("admin-profession");
  const adaptationSlider = document.getElementById("admin-adaptation-slider");
  const adaptationDisplay = document.getElementById("adaptation-value-display");
  const speedSlider = document.getElementById("admin-speed-slider");
  const speedDisplay = document.getElementById("speed-value-display");
  const avatarInput = document.getElementById("admin-avatar-url");
  const avatarPrev = document.getElementById("admin-avatar-preview");
  const coverInput = document.getElementById("admin-cover-url");
  const coverPrev = document.getElementById("admin-cover-preview");
  const ecosystemInput = document.getElementById("admin-ecosystem");
  const behaviorInput = document.getElementById("admin-behavior");
  const skillsInput = document.getElementById("admin-skills");

  if (nameInput) nameInput.value = ident.nombre;
  if (genderInput) genderInput.value = ident.genero;
  if (professionInput) professionInput.value = ident.profesion;
  if (adaptationSlider) adaptationSlider.value = ident.barraAdaptacion;
  if (adaptationDisplay) adaptationDisplay.textContent = `${ident.barraAdaptacion > 0 ? '+' : ''}${ident.barraAdaptacion} semitonos`;
  if (speedSlider) speedSlider.value = ident.velocidad;
  if (speedDisplay) speedDisplay.textContent = `${ident.velocidad}x`;
  if (avatarInput) avatarInput.value = ident.imagenPerfil;
  if (avatarPrev) avatarPrev.src = ident.imagenPerfil;
  if (coverInput) coverInput.value = ident.imagenPortada;
  if (coverPrev) coverPrev.src = ident.imagenPortada;
  if (ecosystemInput) ecosystemInput.value = ident.ecosistema;
  if (behaviorInput) behaviorInput.value = ident.comportamiento;
  if (skillsInput) skillsInput.value = (ident.habilidades || []).join(", ");

  // Seleccionar radio de registro vocal
  const radio = document.querySelector(`input[name='admin-voice-register'][value='${ident.registroVocal}']`);
  if (radio) radio.checked = true;
}

// ==========================================
// VISTA: EXPEDIENTES Y ENTREVISTAS
// ==========================================
async function loadInterviewsView() {
  const container = document.getElementById("interviews-records-table-body");
  if (!container) return;

  container.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Cargando expedientes de Firebase...</td></tr>`;
  
  const records = await interviewsManager.getAllInterviews();
  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No hay entrevistas registradas aún. Inicia una conversación para generar el primer expediente.</td></tr>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const dateFormatted = new Date(r.fechaActividad || r.fechaInicio).toLocaleDateString() + ' ' + 
                          new Date(r.fechaActividad || r.fechaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-mono text-cyan-400 text-xs font-semibold">${escapeHtml(r.numeroExpediente)}</td>
        <td class="py-3 px-4 font-mono text-amber-400 text-xs font-semibold">${escapeHtml(r.numeroSeguimiento)}</td>
        <td class="py-3 px-4 text-xs text-slate-300">${dateFormatted}</td>
        <td class="py-3 px-4 text-xs font-medium text-white">${escapeHtml(r.identidadNombre)} (${r.profesion})</td>
        <td class="py-3 px-4 text-xs text-slate-400">${escapeHtml(r.ecosistema)}</td>
        <td class="py-3 px-4 text-right">
          <button data-view-dialog="${escapeHtml(r.numeroSeguimiento)}" class="px-2.5 py-1 text-xs rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 border border-cyan-700/60">Ver Diálogo</button>
        </td>
      </tr>
    `;
  }).join('');

  container.querySelectorAll("[data-view-dialog]").forEach(btn => {
    btn.addEventListener("click", () => {
      const segId = btn.getAttribute("data-view-dialog");
      const record = records.find(r => r.numeroSeguimiento === segId);
      if (record) {
        showInterviewDetailsModal(record);
      }
    });
  });
}

function showInterviewDetailsModal(record) {
  const modal = document.getElementById("interview-details-modal");
  const modalContent = document.getElementById("interview-details-content");
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center border-b border-slate-700 pb-3">
        <div>
          <span class="text-xs text-slate-400">Expediente:</span>
          <h3 class="text-base font-bold text-cyan-400 font-mono">${record.numeroExpediente}</h3>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-400">Seguimiento:</span>
          <h3 class="text-base font-bold text-amber-400 font-mono">${record.numeroSeguimiento}</h3>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 text-xs bg-slate-800/60 p-3 rounded-lg border border-slate-700">
        <div><strong class="text-slate-400">Atendido por:</strong> ${escapeHtml(record.identidadNombre)} (${record.profesion})</div>
        <div><strong class="text-slate-400">Ecosistema:</strong> ${escapeHtml(record.ecosistema)}</div>
        <div><strong class="text-slate-400">Fecha:</strong> ${new Date(record.fechaActividad).toLocaleString()}</div>
        <div><strong class="text-slate-400">Duración:</strong> ${record.duracionSegundos} segundos</div>
      </div>

      <div>
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Objetivos Abordados:</h4>
        <p class="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded border border-slate-800">${escapeHtml(record.objetivos || 'N/A')}</p>
      </div>

      <div>
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Resultados Obtenidos:</h4>
        <p class="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded border border-slate-800">${escapeHtml(record.resultados || 'N/A')}</p>
      </div>

      <div>
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Transcripción Completa:</h4>
        <div class="max-h-60 overflow-y-auto space-y-2 p-2 bg-slate-950 rounded border border-slate-800 text-xs">
          ${(record.mensajes || []).map(m => `
            <div class="${m.emisor === 'agente' ? 'text-cyan-300' : 'text-slate-100'}">
              <strong>${m.emisor === 'agente' ? record.identidadNombre : (record.usuarioNombre || 'Usuario')}:</strong> ${escapeHtml(m.texto)}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
}

// ==========================================
// VISTA: ESTADÍSTICAS SEMANALES
// ==========================================
async function loadStatsView() {
  const statUsers = document.getElementById("stat-weekly-users");
  const statInterviews = document.getElementById("stat-weekly-interviews");
  const statTotal = document.getElementById("stat-total-historic");
  const ecosystemsList = document.getElementById("stat-ecosystems-list");
  const goalsList = document.getElementById("stat-goals-list");
  const resultsList = document.getElementById("stat-results-list");

  const report = await statsManager.getWeeklyReport();

  if (statUsers) statUsers.textContent = report.totalUsuariosUnicos;
  if (statInterviews) statInterviews.textContent = report.totalEntrevistasSemana;
  if (statTotal) statTotal.textContent = report.totalHistorico;

  if (ecosystemsList) {
    const keys = Object.keys(report.distribucionEcosistemas);
    if (keys.length === 0) {
      ecosystemsList.innerHTML = `<li class="text-slate-500 text-xs">Sin actividad en esta semana.</li>`;
    } else {
      ecosystemsList.innerHTML = keys.map(eco => `
        <li class="flex justify-between items-center py-1.5 border-b border-slate-800 text-xs">
          <span class="text-slate-300">${escapeHtml(eco)}</span>
          <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold">${report.distribucionEcosistemas[eco]} entrevistas</span>
        </li>
      `).join('');
    }
  }

  if (goalsList) {
    if (report.ultimosObjetivos.length === 0) {
      goalsList.innerHTML = `<li class="text-slate-500 text-xs">Aún no se han formulado objetivos esta semana.</li>`;
    } else {
      goalsList.innerHTML = report.ultimosObjetivos.map(obj => `
        <li class="text-xs text-slate-300 bg-slate-800/40 p-2 rounded border border-slate-800">${escapeHtml(obj)}</li>
      `).join('');
    }
  }

  if (resultsList) {
    if (report.ultimosResultados.length === 0) {
      resultsList.innerHTML = `<li class="text-slate-500 text-xs">Aún no se han alcanzado resultados esta semana.</li>`;
    } else {
      resultsList.innerHTML = report.ultimosResultados.map(res => `
        <li class="text-xs text-slate-300 bg-slate-800/40 p-2 rounded border border-slate-800">${escapeHtml(res)}</li>
      `).join('');
    }
  }
}

// ==========================================
// VISUALIZADOR DE ONDAS TIPO SIRI / JARVIS
// ==========================================
function setupVisualizer() {
  canvasVisualizer = document.getElementById("voice-visualizer-canvas");
  if (!canvasVisualizer) return;
  ctxVisualizer = canvasVisualizer.getContext("2d");

  voiceEngine.setVisualizerCallback((freqData) => {
    drawVisualizer(freqData);
  });

  // Dibujar estado en reposo
  drawVisualizer(new Uint8Array(64).fill(0));
}

function drawVisualizer(freqData) {
  if (!ctxVisualizer || !canvasVisualizer) return;
  const width = canvasVisualizer.width = canvasVisualizer.offsetWidth;
  const height = canvasVisualizer.height = canvasVisualizer.offsetHeight;

  ctxVisualizer.clearRect(0, 0, width, height);

  const centerY = height / 2;
  const bufferLength = freqData.length;
  const isSpeaking = voiceEngine.isSpeaking;

  // Si está hablando o escuchando, generar onda armónica
  ctxVisualizer.lineWidth = 3;
  const gradient = ctxVisualizer.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#06b6d4");
  gradient.addColorStop(0.5, "#3b82f6");
  gradient.addColorStop(1, "#8b5cf6");
  ctxVisualizer.strokeStyle = gradient;

  ctxVisualizer.beginPath();
  const sliceWidth = width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = isSpeaking ? (freqData[i] / 128.0) : 0.05 * Math.sin(Date.now() / 400 + i);
    const y = centerY + (v * height * 0.38 * Math.sin(i * 0.4 + Date.now() / 200));

    if (i === 0) {
      ctxVisualizer.moveTo(x, y);
    } else {
      ctxVisualizer.lineTo(x, y);
    }
    x += sliceWidth;
  }

  ctxVisualizer.lineTo(width, centerY);
  ctxVisualizer.stroke();
}

// ==========================================
// MODAL DE CONFIGURACIÓN Y FIREBASE
// ==========================================
function setupSettingsModal() {
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const modal = document.getElementById("settings-modal");
  const btnClose = document.getElementById("btn-close-settings");
  const settingsForm = document.getElementById("settings-form");
  const apiKeyInput = document.getElementById("settings-api-key");
  const geminiKeyInput = document.getElementById("settings-gemini-key");
  const ttsKeyInput = document.getElementById("settings-tts-key");

  if (btnOpenSettings) btnOpenSettings.addEventListener("click", openSettingsModal);
  if (btnClose) btnClose.addEventListener("click", () => modal.classList.add("hidden"));

  // Cerrar modal de detalles de entrevista
  document.getElementById("btn-close-interview-modal")?.addEventListener("click", () => {
    document.getElementById("interview-details-modal")?.classList.add("hidden");
  });

  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const apiKey = apiKeyInput.value.trim();
      const geminiKey = geminiKeyInput.value.trim();
      const ttsKey = ttsKeyInput.value.trim();

      if (apiKey) saveApiKey(apiKey);
      if (geminiKey) conversationBrain.setGeminiApiKey(geminiKey);
      if (ttsKey) voiceEngine.setCloudTTSApiKey(ttsKey);

      state.firebaseStatus = getFirebaseStatus();
      updateFirebaseStatusBadge();
      modal.classList.add("hidden");
      alert("Ajustes guardados correctamente.");
    });
  }
}

function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const apiKeyInput = document.getElementById("settings-api-key");
  const geminiKeyInput = document.getElementById("settings-gemini-key");
  const ttsKeyInput = document.getElementById("settings-tts-key");

  if (apiKeyInput) apiKeyInput.value = localStorage.getItem("tid_firebase_api_key") || "";
  if (geminiKeyInput) geminiKeyInput.value = localStorage.getItem("tid_gemini_api_key") || "";
  if (ttsKeyInput) ttsKeyInput.value = localStorage.getItem("tid_tts_api_key") || "";

  if (modal) modal.classList.remove("hidden");
}

function updateFirebaseStatusBadge() {
  const badge = document.getElementById("firebase-status-badge");
  if (!badge) return;

  if (state.firebaseStatus.hasApiKey) {
    badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Firebase: Conectado (tid-agent)`;
  } else {
    badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60 cursor-pointer";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Firebase: Ingrese API Key`;
    badge.onclick = openSettingsModal;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
