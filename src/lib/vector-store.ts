import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { embedding } from "./embeddings";
import { supabase } from "./supabase";

export const supabaseVectorStore = new SupabaseVectorStore(embedding, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});
