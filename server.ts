import express from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as vite from 'vite';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Face detection endpoint
app.post('/api/detect-face', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Extract base64 data
    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/);
    let base64Data = image;
    let mimeType = 'image/jpeg';

    if (base64Match) {
      mimeType = base64Match[1];
      base64Data = base64Match[2];
    } else if (image.includes(',')) {
      base64Data = image.split(',')[1];
      mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
    }

    const prompt = "Analyze this image. Does it contain a clear, identifiable human face (front-facing selfie)? Return faceDetected: true only if it is a clear face photo. Do not accept logos, objects, ID documents, or full-body photos. Return a JSON object: { \"faceDetected\": boolean, \"reason\": \"string\" }";

    console.log(`Detecting face with model: gemini-1.5-flash, mimeType: ${mimeType}`);

    const model = ai.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faceDetected: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ["faceDetected", "reason"],
        },
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();
    console.log('AI Response:', responseText);

    if (!responseText) {
      throw new Error('No response from AI');
    }
    const parsedResult = JSON.parse(responseText);
    res.json(parsedResult);
  } catch (error: any) {
    console.error('Face detection error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze image', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

if (process.env.NODE_ENV === 'development') {
  const viteServer = await vite.createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(viteServer.middlewares);
  app.use('*', async (req, res, next) => {
    try {
      const url = req.originalUrl;
      let template = await viteServer.transformIndexHtml(url, (await import('fs')).readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8'));
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      viteServer.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
