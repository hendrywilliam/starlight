import { OpenAIEmbeddings } from "@langchain/openai";

export const embedding = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
  dimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS!) || 1536,
});
