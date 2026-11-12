# TID-Agent: Agente Conversacional con Voz Humana (6 Registros) y Cerebro en Firebase

Sistema integral de agente conversacional inteligente tipo Alexa/Siri/Jarvis con **"un solo cerebro y múltiples rostros"**, desarrollado para Google Antigravity y respaldado por **Firebase Authentication (Google Sign-In)** y **Cloud Firestore** en el proyecto `tid-agent`.

---

## 📌 1. Respuesta a la Pregunta Clave: ¿Puede establecerse una voz específica en el código para que funcione en todos los dispositivos?

> **SÍ, absolutamente.** 

### La limitación de las "voces invocadas" nativas:
Cuando una aplicación web o móvil invoca las voces nativas del sistema operativo (`window.speechSynthesis`), la voz depende del fabricante del dispositivo:
- En **Windows**: Microsoft David o Sabina.
- En **Android**: Motores de Google TTS o Samsung.
- En **iOS / macOS**: Voces de Apple (Siri, Mónica).
- En **Linux**: eSpeak o Festival.
*Por lo tanto, si dependes exclusivamente de las voces del sistema operativo, el agente NO sonará igual en todos los dispositivos.*

### La Solución Definitiva implementada en TID-Agent:
Para que la voz sea **100% idéntica en cualquier smartphone Android, iPhone, tablet, computadora o empaquetado en APK**:
1. **Flujo de Audio Neural Centralizado (Cloud TTS / Gemini Audio API)**:
   El texto es enviado al motor neural centralizado de Google (usando las voces de alta fidelidad `es-ES-Neural2`, `es-US-Journey`, `es-ES-Studio`). El motor devuelve el archivo/flujo de audio digital (MP3/WAV/PCM) que se decodifica y reproduce a través de la **Web Audio API (`AudioContext`)**. Como el flujo binario de audio es el mismo, **suena con la misma voz humana exacta en todos los dispositivos**.
2. **Procesador DSP con Filtros de Formantes Acústicos**:
   El motor incluye un ecualizador de formantes (`BiquadFilterNode` de tipo *peaking*) calibrado para simular la resonancia anatómica del tracto vocal humano según el registro seleccionado (resonancia torácica en Bajo/Barítono, oral en Tenor, pectoral en Contralto, y craneal en Mezzosoprano/Soprano).
3. **Barra de Adaptación Continua**:
   Permite modular dinámicamente el tono y semitonos (-10 a +10 semitonos) y velocidad (0.8x a 1.3x) en tiempo real para generar variaciones vocales infinitas sin perder la naturalidad humana.

---

## 🎼 2. Los 6 Registros Vocales Humanos

El Panel Administrador permite seleccionar y adaptar los 6 registros vocales:

| Registro | Género | Rango Frecuencial | Timbre y Carácter | Modelo Neural de Referencia |
| :--- | :--- | :--- | :--- | :--- |
| **Bajo** | Masculino | 80 Hz – 140 Hz | Profundo, solemne, calmante, envolvente | `es-ES-Neural2-B` |
| **Barítono** | Masculino | 100 Hz – 180 Hz | Cálido, resonante, persuasivo, equilibrado | `es-US-Neural2-B` |
| **Tenor** | Masculino | 140 Hz – 260 Hz | Claro, articulado, brillante, pedagógico | `es-ES-Studio-C` |
| **Contralto** | Femenino | 160 Hz – 320 Hz | Cálido, aterciopelado, empático, terapéutico | `es-ES-Neural2-F` |
| **Mezzosoprano** | Femenino | 200 Hz – 400 Hz | Versátil, analítico, seguro, profesional | `es-US-Neural2-A` |
| **Soprano** | Femenino | 250 Hz – 550 Hz | Luminoso, ligero, juvenil, motivador | `es-ES-Neural2-E` |

---

## 🧠 3. Arquitectura del Cerebro en Firebase

El backend reside en el proyecto Firebase existente **`tid-agent`** (App ID: `1:838989599692:web:0194cf58e8983ab3654369`).

### Colecciones en Cloud Firestore:

#### 1. Colección `identidades` (Los "Rostros" del Agente)
Cada documento representa una identidad o profesión configurada desde el Panel Administrador:
- `id`: Identificador único (ej: `dra-sofia-terapeuta`, `lic-mateo-coach`)
- `nombre`: Seudónimo del agente
- `genero`: `'masculino'` | `'femenino'`
- `profesion`: `'Terapeuta'`, `'Coach'`, `'Consultor'`, `'Maestro'`, `'Instructor'`, `'Consejero'`
- `registroVocal`: `'Bajo'` \| `'Barítono'` \| `'Tenor'` \| `'Contralto'` \| `'Mezzosoprano'` \| `'Soprano'`
- `barraAdaptacion`: Ajuste de semitonos (-10 a +10)
- `velocidad`: Factor de cadencia (0.8x a 1.3x)
- `imagenPerfil`: URL de la foto de perfil (avatar)
- `imagenPortada`: URL de la imagen de portada (banner del agente)
- `ecosistema`: Ecosistema de invocación (Portal Web, App Móvil APK, Campus Virtual, etc.)
- `comportamiento`: Directiva de personalidad, empatía y metodología de atención
- `habilidades`: Lista de competencias profesionales asignadas
- `activo`: boolean

#### 2. Colección `entrevistas` (Sesiones y Expedientes)
Cada sesión se guarda automáticamente al finalizar con las claves solicitadas:
- `numeroExpediente`: Número de registro permanente del usuario (ej: `EXP-TID-83898`)
- `numeroSeguimiento`: Código único de seguimiento por entrevista (ej: `SEG-20261112-7491`), que diferencia cada fecha de actividad
- `usuarioId`: UID de Firebase Auth
- `usuarioNombre`: Nombre del usuario
- `usuarioEmail`: Correo de la cuenta Google
- `identidadId`: ID del rostro que atendió la entrevista
- `identidadNombre`: Nombre/seudónimo del agente
- `profesion`: Profesión del agente
- `ecosistema`: Ecosistema donde se realizó la sesión
- `fechaActividad`: Fecha y hora de la sesión (Timestamp ISO)
- `duracionSegundos`: Tiempo total de la entrevista
- `fraseInicio`: `"Hola, ¿cómo puedo ayudarte?"`
- `fraseDespedida`: `"Ha sido un placer atenderte. Si me necesitas, estaré a tus órdenes 24 horas al día. Hasta pronto"`
- `mensajes`: Array con la transcripción completa turno por turno
- `objetivos`: Objetivos detectados y abordados en la sesión
- `resultados`: Conclusiones, consejos y resultados obtenidos
- `estado`: `'completada'`

#### 3. Estadísticas Semanales
El sistema calcula en tiempo real para el Panel Administrador:
- Total de usuarios únicos atendidos en la semana
- Total de entrevistas realizadas en los últimos 7 días
- Distribución porcentual por ecosistema
- Resumen de objetivos y resultados alcanzados

---

## 🎙️ 4. Protocolo Conversacional Estricto

1. **Permiso de Micrófono**: Solicita permiso explícito al usuario mediante `navigator.mediaDevices.getUserMedia` antes de comenzar.
2. **Frase de Inicio Obligatoria**:
   > *"Hola, ¿cómo puedo ayudarte?"*
3. **Frase de Despedida Obligatoria**:
   > *"Ha sido un placer atenderte. Si me necesitas, estaré a tus órdenes 24 horas al día. Hasta pronto"*
4. **Visualizador Holográfico de Onda Vocal**:
   Canvas en tiempo real que reacciona a las frecuencias de voz tipo Siri/Alexa/Jarvis tanto al hablar el agente como al escuchar al usuario.

---

## ⚙️ 5. Pasos para Configurar Google Sign-In en Firebase Console

Para activar Google Sign-In en el proyecto `tid-agent`:
1. Ingresa a la [Consola de Firebase](https://console.firebase.google.com/project/tid-agent/authentication/providers).
2. Selecciona **Authentication** > pestaña **Sign-in method**.
3. Haz clic en **Google** y actívalo.
4. En **Dominios autorizados** (Authorized Domains), asegúrate de tener:
   - `localhost`
   - `tid-agent.firebaseapp.com`
5. En la configuración del proyecto (**Project Settings** > General), copia la **Web API Key** (Clave de API web).
6. En la aplicación TID-Agent, haz clic en el ícono de engranaje (Ajustes) e ingresa la API Key. ¡El botón **"Iniciar con Google"** quedará 100% operativo!

---

## 🚀 6. Ejecución Local

Para probar la aplicación inmediatamente en tu navegador:
```bash
# Desde la carpeta del proyecto:
cd C:\Users\asmall\.gemini\antigravity\scratch\tid-agent

# Iniciar servidor local:
npx serve . -l 3000
```
O simplemente abre `index.html` en tu navegador.
