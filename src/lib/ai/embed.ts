/** Deterministic local embeddings (256-dim hashed bag of words). */
export const EMBED_DIM = 256;

const STOPWORDS = new Set([
  "the","and","for","with","you","your","are","can","our","have","has","was","were","this","that",
  "from","not","but","all","any","how","what","when","where","who","will","would","should","about",
  "a","an","is","it","to","of","in","on","at","do","does","i","we","my","me","us","be","or","if",
  "hai","hain","kya","ka","ki","ke","ko","me","mein","aur","aap","hum","kar","karna","please",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u0900-\u097F]+/g, (m) => ` ${m} `)
    .split(/[^a-z0-9\u0900-\u097F]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function hash(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function embed(text: string): number[] {
  const vector = new Array<number>(EMBED_DIM).fill(0);
  for (const token of tokenize(text)) {
    vector[hash(token) % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const HINDI_PATTERN = /[\u0900-\u097F]/;

export function detectLanguage(text: string): "en" | "hi" {
  if (HINDI_PATTERN.test(text)) return "hi";
  const hindiRoman = /\b(kitna|kitne|kya|kaise|kab|kahan|chahiye|milega|karna|hai|hain|acha|dhanyavad|shukriya|booking|samay|paisa|kimat)\b/i;
  return hindiRoman.test(text) ? "hi" : "en";
}
