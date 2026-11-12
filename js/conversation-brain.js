/**
 * CEREBRO CONVERSACIONAL DE TID-AGENT
 * Conecta los múltiples rostros e identidades a un solo núcleo inteligente.
 * Maneja el diálogo gentil, amable y satisfactorio.
 * Frase de apertura: "Hola, ¿cómo puedo ayudarte?"
 * Frase de despedida: "Ha sido un placer atenderte. Si me necesitas, estaré a tus órdenes 24 horas al día. Hasta pronto"
 */

export const GREETING_PHRASE = "Hola, ¿cómo puedo ayudarte?";
export const FAREWELL_PHRASE = "Ha sido un placer atenderte. Si me necesitas, estaré a tus órdenes 24 horas al día. Hasta pronto";

class ConversationBrain {
  constructor() {
    this.geminiApiKey = localStorage.getItem("tid_gemini_api_key") || "";
  }

  setGeminiApiKey(key) {
    this.geminiApiKey = key ? key.trim() : "";
    localStorage.setItem("tid_gemini_api_key", this.geminiApiKey);
  }

  /**
   * Genera la respuesta conversacional adecuada según la identidad activa, sus habilidades,
   * el ecosistema de invocación y el historial de la sesión.
   */
  async generateResponse(userInput, history = [], identity = null) {
    const textLower = userInput.toLowerCase();

    // Detección de intención de despedida / finalizar sesión
    const farewellKeywords = ["adiós", "adios", "hasta luego", "hasta pronto", "muchas gracias, eso es todo", "terminar", "finalizar", "chao", "bye", "gracias por todo"];
    const isFarewell = farewellKeywords.some(kw => textLower.includes(kw));

    if (isFarewell) {
      return {
        text: FAREWELL_PHRASE,
        isFarewell: true,
        detectedObjectives: this.extractObjectives(history, userInput),
        detectedResults: this.extractResults(history, userInput, identity)
      };
    }

    // Si hay Gemini API Key configurada, utilizar la inteligencia de Gemini
    if (this.geminiApiKey && this.geminiApiKey.trim().length > 20) {
      try {
        const aiResponse = await this.callGeminiAPI(userInput, history, identity);
        return {
          text: aiResponse,
          isFarewell: false,
          detectedObjectives: this.extractObjectives(history, userInput),
          detectedResults: this.extractResults(history, userInput, identity)
        };
      } catch (err) {
        console.warn("Fallo al consultar Gemini API, utilizando motor heurístico inteligente:", err);
      }
    }

    // Motor conversacional heurístico empático basado en el rol de la identidad
    const localResponse = this.generateRoleBasedResponse(userInput, history, identity);
    return {
      text: localResponse,
      isFarewell: false,
      detectedObjectives: this.extractObjectives(history, userInput),
      detectedResults: this.extractResults(history, userInput, identity)
    };
  }

  /**
   * Llamada al modelo Gemini (gemini-2.5-flash / gemini-1.5-flash)
   */
  async callGeminiAPI(userInput, history, identity) {
    const systemPrompt = `Eres ${identity.nombre}, ejerces como ${identity.profesion} dentro del ecosistema '${identity.ecosistema || "Plataforma Principal"}'.
Personalidad y comportamiento: ${identity.comportamiento || "Empático, cálido, cortés, altamente profesional y reconfortante"}.
Habilidades clave asignadas: ${(identity.habilidades || []).join(", ")}.
Directrices conversacionales obligatorias:
1. Responde siempre con tono cálido, humano, gentil, amable y completamente satisfactorio.
2. Mantén las respuestas conversacionales y concisas (2 a 4 oraciones) para ser escuchadas mediante voz.
3. Si el usuario te hace una consulta o plantea una inquietud, valida sus sentimientos, formula una solución o consejo práctico y haz una pregunta de seguimiento constructiva.
4. Si el usuario indica que desea terminar la sesión, despídete estrictamente con: "${FAREWELL_PHRASE}".`;

    const contents = [];
    // Formato de historial para Gemini
    history.slice(-6).forEach(turn => {
      contents.push({
        role: turn.emisor === "usuario" ? "user" : "model",
        parts: [{ text: turn.texto }]
      });
    });
    contents.push({
      role: "user",
      parts: [{ text: userInput }]
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`;
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 250
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Comprendo lo que me dices. Estoy aquí para apoyarte en cada paso.";
  }

  /**
   * Motor heurístico por profesiones: Consejero, Coach, Consultor, Terapeuta, Maestro, Instructor
   */
  generateRoleBasedResponse(userInput, history, identity) {
    const profesion = (identity?.profesion || "Consejero").toLowerCase();
    const nombre = identity?.nombre || "Tu asesor";
    const habilidades = (identity?.habilidades || []).join(", ");
    const textLower = userInput.toLowerCase();

    // Respuestas según la profesión
    if (profesion.includes("terapeuta") || profesion.includes("consejer")) {
      if (textLower.includes("ansiedad") || textLower.includes("estrés") || textLower.includes("preocupad") || textLower.includes("triste")) {
        return `Comprendo profundamente lo que estás experimentando. Es perfectamente válido sentirse así. Tomemos un momento para una respiración pausada. ¿Qué situación en particular ha detonado más esta sensación hoy?`;
      }
      if (textLower.includes("gracias") || textLower.includes("ayuda")) {
        return `Es un honor para mí acompañarte en este espacio seguro. Cada paso que das hacia tu bienestar cuenta. ¿Hay alguna otra inquietud o pensamiento que desees compartir conmigo?`;
      }
      return `Te escucho con total atención. Como ${identity.profesion}, te sugiero mirar esto con calma y compasión hacia ti mismo. ¿Cuál sería el primer alivio o cambio que desearías sentir en este momento?`;
    }

    if (profesion.includes("coach")) {
      if (textLower.includes("meta") || textLower.includes("objetivo") || textLower.includes("proyecto") || textLower.includes("plan")) {
        return `Excelente enfoque. Para convertir esa meta en un resultado tangible, definamos la acción más concreta que puedes ejecutar en las próximas 24 horas. ¿Qué recurso clave necesitas para dar ese primer paso?`;
      }
      if (textLower.includes("bloqueo") || textLower.includes("no sé") || textLower.includes("miedo")) {
        return `El bloqueo es solo una señal de que estás a punto de superar un nuevo umbral. Desafiemos esa limitación: si tuvieras la certeza absoluta de que vas a triunfar, ¿qué decisión tomarías ahora mismo?`;
      }
      return `Me gusta tu determinación. Como tu Coach, mi compromiso es ayudarte a maximizar tu potencial aplicando ${habilidades || 'enfoque estratégico'}. ¿En qué área específica quieres enfocarte hoy?`;
    }

    if (profesion.includes("consultor")) {
      if (textLower.includes("negocio") || textLower.includes("empresa") || textLower.includes("costo") || textLower.includes("estrategia")) {
        return `Desde la perspectiva de consultoría estratégica en ${identity.ecosistema || 'tu ecosistema'}, es crucial evaluar los indicadores de impacto y la viabilidad operativa. ¿Cuál es el principal cuello de botella que enfrenta tu proyecto actualmente?`;
      }
      return `Entendido. Mi rol como Consultor es estructurar un diagnóstico claro y alternativas accionables. Cuéntame los antecedentes principales para diseñar juntos la mejor ruta de solución.`;
    }

    if (profesion.includes("maestro") || profesion.includes("instructor") || profesion.includes("profesor")) {
      if (textLower.includes("aprender") || textLower.includes("estudiar") || textLower.includes("examen") || textLower.includes("entender")) {
        return `¡Esa es una excelente pregunta de aprendizaje! Vamos a desglosarla paso a paso con un ejemplo práctico para que sea intuitivo y fácil de asimilar. ¿Por cuál concepto te gustaría que comencemos?`;
      }
      return `Como tu ${identity.profesion}, me alegra acompañar tu curiosidad intelectual. La clave está en la práctica constante y el pensamiento crítico. ¿Qué aspecto te gustaría profundizar hoy?`;
    }

    // Default universal gentil
    return `Te escucho atentamente. Como ${identity?.profesion || 'acompañante'}, mi propósito es brindarte una orientación clara y reconfortante. ¿Cómo te gustaría que abordemos este tema juntos?`;
  }

  /**
   * Extrae objetivos de la sesión
   */
  extractObjectives(history, lastInput) {
    const combined = [...history.map(h => h.texto), lastInput].join(" ");
    if (combined.toLowerCase().includes("estrés") || combined.toLowerCase().includes("ansiedad")) {
      return "Gestión del estrés, equilibrio emocional y técnicas de respiración consciente.";
    }
    if (combined.toLowerCase().includes("meta") || combined.toLowerCase().includes("proyecto") || combined.toLowerCase().includes("trabajo")) {
      return "Clarificación de metas profesionales, diseño de plan de acción y superación de obstáculos.";
    }
    if (combined.toLowerCase().includes("estudio") || combined.toLowerCase().includes("aprender") || combined.toLowerCase().includes("curso")) {
      return "Asimilación de conocimientos clave, técnicas de estudio y resolución de dudas temáticas.";
    }
    return "Acompañamiento integral, orientación personalizada y resolución de inquietudes.";
  }

  /**
   * Extrae resultados de la sesión
   */
  extractResults(history, lastInput, identity) {
    return `Sesión completada satisfactoriamente con ${identity?.nombre || 'el agente'} (${identity?.profesion || 'Asesor'}). Diálogo gentil, amable y constructivo alcanzado. Próximos pasos y plan de acción definidos.`;
  }
}

export const conversationBrain = new ConversationBrain();
