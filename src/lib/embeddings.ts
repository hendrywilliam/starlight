import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
  apiKey: process.env.OPENAI_API_KEY,
  dimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS!) || 0,
});
