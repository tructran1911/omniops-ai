import 'server-only';
import { GoogleGenAI } from '@google/genai';

/**
 * GEMINI_MOCK=true: skip Gemini and return the ground-truth data from the synthetic documents' manifest.
 * For local dry runs ONLY, when no API key is available. Never enable it on Cloud Run.
 */
export const isMock = () => process.env.GEMINI_MOCK === 'true';
// TODO(setup): confirm the model name in AI Studio (README → Setup on Google Cloud, step 4). Prefer setting it through
// GEMINI_MODEL (.env.local and scripts/deploy.ps1 -Model); the value below is only the fallback default.
export const modelName = () => (isMock() ? 'mock' : process.env.GEMINI_MODEL ?? 'gemini-3.8-flash');

let client: GoogleGenAI | null = null;

// Lazy init: the client is only created on first use, so `next build` does not need an API key.
function ai(): GoogleGenAI {
  if (client) return client;
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
    });
  } else {
    if (!process.env.GEMINI_API_KEY) throw new Error('Missing environment variable GEMINI_API_KEY');
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/** Send one PDF + a prompt, get JSON back following the schema. */
export async function extractJson<T>(pdf: Buffer, prompt: string, schema: object): Promise<T> {
  const res = await ai().models.generateContent({
    model: modelName(),
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } },
        { text: prompt },
      ],
    }],
    config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 },
  });
  return JSON.parse(res.text ?? '{}') as T;
}

/** Send a text prompt, get JSON back following the schema. */
export async function generateJson<T>(prompt: string, schema: object): Promise<T> {
  const res = await ai().models.generateContent({
    model: modelName(),
    contents: prompt,
    config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2 },
  });
  return JSON.parse(res.text ?? '{}') as T;
}

/** Retry once after 2 seconds when a Gemini call fails (network, 429, 5xx). */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, 2000));
    return withRetry(fn, retries - 1);
  }
}
