import { db } from "@/lib/db";
import { cosine, embed, tokenize } from "@/lib/ai/embed";

export type RetrievedChunk = {
  id: string;
  docId: string;
  title: string;
  content: string;
  score: number;
};

/**
 * Hybrid retrieval: cosine similarity over local embeddings plus keyword overlap.
 * Swappable with pgvector + an embedding model in production (see docs/architecture.md).
 */
export async function retrieveKnowledge(
  tenantId: string,
  query: string,
  options: { limit?: number; minScore?: number } = {}
): Promise<RetrievedChunk[]> {
  const { limit = 4, minScore = 0.12 } = options;
  const queryVector = embed(query);
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return [];

  const chunks = await db(tenantId).knowledgeChunk.findMany({ take: 500 });
  const scored = chunks.map((chunk) => {
    const semantic = cosine(queryVector, chunk.embedding ?? []);
    const chunkTokens = tokenize(`${chunk.content} ${chunk.keywords.join(" ")}`);
    const overlap = chunkTokens.filter((token) => queryTokens.has(token)).length;
    const lexical = overlap / Math.max(queryTokens.size, 1);
    const keywordBoost = chunk.keywords.some((k) => query.toLowerCase().includes(k.toLowerCase())) ? 0.25 : 0;
    return {
      id: chunk.id,
      docId: chunk.docId,
      title: "",
      content: chunk.content,
      score: Number((semantic * 0.55 + lexical * 0.45 + keywordBoost).toFixed(3)),
    };
  });

  const top = scored
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!top.length) return [];

  const docs = await db(tenantId).knowledgeDoc.findMany({
    where: { id: { in: [...new Set(top.map((c) => c.docId))] } },
    select: { id: true, title: true },
  });
  const titles = new Map(docs.map((doc) => [doc.id, doc.title]));
  return top.map((chunk) => ({ ...chunk, title: titles.get(chunk.docId) ?? "Business info" }));
}

/** Split a document into overlapping, retrievable chunks. */
export function chunkText(text: string, size = 700, overlap = 120): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if ((buffer + "\n\n" + paragraph).length > size && buffer) {
      chunks.push(buffer.trim());
      buffer = buffer.slice(-overlap) + "\n\n" + paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

/** Rebuild all chunks for a doc (called after knowledge edits). */
export async function reindexDocument(tenantId: string, docId: string, content: string, keywords: string[]) {
  const database = db(tenantId);
  await database.knowledgeChunk.deleteMany({ where: { docId } });
  const pieces = chunkText(content);
  for (const piece of pieces) {
    await database.knowledgeChunk.create({
      data: {
        tenantId,
        docId,
        content: piece,
        embedding: embed(piece),
        keywords,
      },
    });
  }
  return pieces.length;
}
