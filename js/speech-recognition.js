/**
 * GESTOR DE RECONOCIMIENTO DE VOZ Y MICRÓFONO
 * Solicita permiso explícito de micrófono y maneja la captura tipo Siri/Alexa/Jarvis
 */

class SpeechRecognitionManager {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.hasMicPermission = false;
    this.onResultCallback = null;
    this.onStatusChange = null;
    this.lang = "es-ES";

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn("SpeechRecognition no está soportado nativamente en este navegador.");
      return;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.lang = this.lang;
    this.recognition.continuous = false; // Turno conversacional interactivo
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStatusChange) this.onStatusChange("escuchando");
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (this.onResultCallback) {
        this.onResultCallback({
          final: finalTranscript.trim(),
          interim: interimTranscript.trim()
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("SpeechRecognition error:", event.error);
      this.isListening = false;
      if (this.onStatusChange) this.onStatusChange("error", event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStatusChange) this.onStatusChange("inactivo");
    };
  }

  /**
   * Solicita explícitamente el permiso del micrófono al usuario
   */
  async requestMicPermission() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.hasMicPermission = true;
        // Cerrar stream inicial de prueba
        stream.getTracks().forEach(track => track.stop());
        return { granted: true };
      } else {
        return { granted: false, reason: "Navegador no soporta navigator.mediaDevices.getUserMedia" };
      }
    } catch (err) {
      console.error("Permiso de micrófono denegado:", err);
      this.hasMicPermission = false;
      return { granted: false, error: err };
    }
  }

  /**
   * Comienza a escuchar al usuario
   */
  async startListening() {
    if (!this.hasMicPermission) {
      const perm = await this.requestMicPermission();
      if (!perm.granted) {
        throw new Error("No se ha concedido permiso para acceder al micrófono.");
      }
    }

    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) {
        throw new Error("Reconocimiento de voz no compatible con este navegador.");
      }
    }

    try {
      this.recognition.start();
    } catch (err) {
      // Si ya estaba escuchando, ignorar
      console.warn("Intento de iniciar reconocimiento ya activo:", err);
    }
  }

  /**
   * Detiene la escucha
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  setResultCallback(callback) {
    this.onResultCallback = callback;
  }

  setStatusCallback(callback) {
    this.onStatusChange = callback;
  }
}

export const speechManager = new SpeechRecognitionManager();
