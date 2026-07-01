import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
          systemInstruction: "You generate professional analog synthesizer configurations. Map any musical or physical description into precise subtractive synthesis parameters.",
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
              explanation: {
                type: Type.STRING,
                description: "A 1-sentence breakdown of how this synthesizes the prompt"
              }
            },
            required: ["name", "cutoff", "resonance", "distortion", "sidechainEnabled", "explanation"]
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
  let cutoff = 800;
  let resonance = 6.0;
  let distortion = 0.4;
  let sidechain = true;
  let name = "Procedural Void";

  if (norm.includes("bass") || norm.includes("deep") || norm.includes("sub")) {
    cutoff = 350;
    resonance = 2.5;
    distortion = 0.5;
    name = "Subterranean Bassline";
  } else if (norm.includes("scream") || norm.includes("acid") || norm.includes("squelch") || norm.includes("sharp")) {
    cutoff = 1800;
    resonance = 11.5;
    distortion = 0.8;
    name = "Screaming Squelcher";
  } else if (norm.includes("metallic") || norm.includes("noise") || norm.includes("laser")) {
    cutoff = 2200;
    resonance = 9.0;
    distortion = 0.9;
    name = "Metal Oxide Laser";
  } else if (norm.includes("ambient") || norm.includes("soft") || norm.includes("pad")) {
    cutoff = 500;
    resonance = 3.0;
    distortion = 0.1;
    sidechain = false;
    name = "Ethereal Ambient Swell";
  }

  return {
    name: `${name} (Local Engine)`,
    cutoff: Math.round(cutoff + (Math.random() * 100 - 50)),
    resonance: parseFloat((resonance + (Math.random() * 2 - 1)).toFixed(2)),
    distortion: parseFloat(Math.min(1.0, Math.max(0.0, distortion + (Math.random() * 0.2 - 0.1))).toFixed(2)),
    sidechainEnabled: sidechain,
    explanation: `Synthesized dynamically using offline fallback DSP descriptors for: "${prompt}"`
  };
}

startServer();
