import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { embeddings } from "./embeddings";
import { supabase } from "./supabase";

export const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});
