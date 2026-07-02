import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json());

  // Initialize the Gemini SDK client with required headers and optional fallback
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Endpoint: Generate unique synth sound parameters using Gemini AI
  app.post("/api/generate-sound", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: "A descriptive prompt string is required." });
        return;
      }

      if (!apiKey) {
        // Fallback with clever pseudo-random generation to ensure the user gets a working experience
        // even if their workspace credentials haven't updated yet.
        console.warn("GEMINI_API_KEY is missing. Using high-fidelity local procedural generator fallback.");
        const fallbackValue = generateFallbackPreset(prompt);
        res.json(fallbackValue);
        return;
      }

      const promptString = `You are a legendary sound designer specialized in analog subtractive synthesizers, 
      Eurorack modular rigs, and acid techno production. Design a unique monosynth voice patch configuration 
      that reflects the following sonic request: "${prompt}".`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptString,
        config: {
          systemInstruction: "You generate professional analog synthesizer configurations. Map any musical or physical description into precise subtractive synthesis and delay effects parameters.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "A short, creative, futuristic acid-techno name for this patch"
              },
              cutoff: {
                type: Type.INTEGER,
                description: "VCF Filter cutoff frequency in Hz, between 150 and 2600"
              },
              resonance: {
                type: Type.NUMBER,
                description: "Filter resonance Q value, between 1.0 and 13.0"
              },
              distortion: {
                type: Type.NUMBER,
                description: "Overdrive saturation factor, between 0.0 and 1.0"
              },
              sidechainEnabled: {
                type: Type.BOOLEAN,
                description: "Whether this sound pumps with the kick drum using 4/4 sidechain"
              },
              waveform: {
                type: Type.STRING,
                description: "The primary synthesizer oscillator waveform. Must be either 'sawtooth' or 'square'"
              },
              decay: {
                type: Type.NUMBER,
                description: "Envelope and filter decay time in seconds, between 0.05 and 1.2"
              },
              envMod: {
                type: Type.NUMBER,
                description: "Filter envelope modulation sweep depth in octaves, between 0.5 and 6.0"
              },
              portamento: {
                type: Type.NUMBER,
                description: "Glide/slide transition time between notes in seconds, between 0.0 and 0.4"
              },
              delayFeedback: {
                type: Type.NUMBER,
                description: "Feedback amount of the delay echo effect, between 0.0 and 0.85"
              },
              delayMix: {
                type: Type.NUMBER,
                description: "Dry/wet mix level of the delay echo effect, between 0.0 and 0.75"
              },
              explanation: {
                type: Type.STRING,
                description: "A 1-sentence breakdown of how this synthesizes the prompt"
              }
            },
            required: [
              "name", "cutoff", "resonance", "distortion", "sidechainEnabled", 
              "waveform", "decay", "envMod", "portamento", "delayFeedback", "delayMix", "explanation"
            ]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty text received from Gemini API.");
      }

      const parsedJson = JSON.parse(responseText.trim());
      res.json(parsedJson);

    } catch (error: any) {
      console.error("Gemini sound generation error:", error);
      res.status(500).json({ 
        error: "Failed to forge sound preset via AI.", 
        details: error.message,
        fallback: generateFallbackPreset(req.body.prompt || "default")
      });
    }
  });

  // --- Vite Dev Server Middleware vs Production Static Serving ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TechnoForge AI Server running on http://0.0.0.0:${PORT}`);
  });
}

// Procedural synthesizer model fallback to guarantee continuous operation
function generateFallbackPreset(prompt: string) {
  const norm = prompt.toLowerCase();
  
  // Base default values
  let name = "Procedural Swell";
  let cutoff = 800;
  let resonance = 6.0;
  let distortion = 0.35;
  let sidechain = true;
  let waveform: "sawtooth" | "square" = "sawtooth";
  let decay = 0.22;
  let envMod = 3.2;
  let portamento = 0.05;
  let delayFeedback = 0.40;
  let delayMix = 0.20;

  // Waveform selection
  if (norm.includes("square") || norm.includes("hollow") || norm.includes("woody")) {
    waveform = "square";
  }

  // Preset style branching
  if (norm.includes("bass") || norm.includes("deep") || norm.includes("sub") || norm.includes("low")) {
    cutoff = 350;
    resonance = 2.5;
    distortion = 0.45;
    decay = 0.18;
    envMod = 1.5;
    delayFeedback = 0.25;
    delayMix = 0.12;
    name = "Subterranean Bassline";
  } else if (norm.includes("scream") || norm.includes("acid") || norm.includes("squelch") || norm.includes("sharp") || norm.includes("303")) {
    cutoff = 1650;
    resonance = 11.0;
    distortion = 0.75;
    decay = 0.15;
    envMod = 4.8;
    portamento = 0.12;
    delayFeedback = 0.50;
    delayMix = 0.30;
    name = "Screaming Squelcher";
  } else if (norm.includes("metallic") || norm.includes("noise") || norm.includes("laser") || norm.includes("industrial")) {
    cutoff = 2100;
    resonance = 8.5;
    distortion = 0.85;
    decay = 0.25;
    envMod = 3.8;
    delayFeedback = 0.60;
    delayMix = 0.45;
    name = "Metal Oxide Laser";
  } else if (norm.includes("ambient") || norm.includes("soft") || norm.includes("pad") || norm.includes("chill")) {
    cutoff = 480;
    resonance = 3.5;
    distortion = 0.05;
    sidechain = false;
    decay = 0.75;
    envMod = 1.2;
    portamento = 0.15;
    delayFeedback = 0.75;
    delayMix = 0.55;
    name = "Ethereal Ambient Swell";
  }

  // Refined sub-properties based on prompt modifiers
  if (norm.includes("pluck") || norm.includes("short") || norm.includes("tight") || norm.includes("punchy")) {
    decay = 0.08;
    delayFeedback = Math.max(0.1, delayFeedback - 0.1);
  }
  if (norm.includes("slide") || norm.includes("glide") || norm.includes("slither") || norm.includes("legato")) {
    portamento = 0.22;
  }
  if (norm.includes("space") || norm.includes("echo") || norm.includes("cavern") || norm.includes("reverb")) {
    delayFeedback = 0.70;
    delayMix = 0.45;
  }
  if (norm.includes("dry") || norm.includes("clean")) {
    delayFeedback = 0.0;
    delayMix = 0.0;
    distortion = Math.max(0.0, distortion - 0.25);
  }

  return {
    name: `${name} (Local Engine)`,
    cutoff: Math.round(cutoff + (Math.random() * 80 - 40)),
    resonance: parseFloat((resonance + (Math.random() * 1.5 - 0.75)).toFixed(2)),
    distortion: parseFloat(Math.min(1.0, Math.max(0.0, distortion + (Math.random() * 0.15 - 0.07))).toFixed(2)),
    sidechainEnabled: sidechain,
    waveform,
    decay: parseFloat(Math.min(1.2, Math.max(0.05, decay + (Math.random() * 0.06 - 0.03))).toFixed(2)),
    envMod: parseFloat(Math.min(6.0, Math.max(0.5, envMod + (Math.random() * 0.4 - 0.2))).toFixed(2)),
    portamento: parseFloat(Math.min(0.4, Math.max(0.0, portamento + (Math.random() * 0.04 - 0.02))).toFixed(2)),
    delayFeedback: parseFloat(Math.min(0.85, Math.max(0.0, delayFeedback + (Math.random() * 0.06 - 0.03))).toFixed(2)),
    delayMix: parseFloat(Math.min(0.75, Math.max(0.0, delayMix + (Math.random() * 0.06 - 0.03))).toFixed(2)),
    explanation: `Synthesized dynamically using offline fallback DSP descriptors for: "${prompt}"`
  };
}

startServer();
