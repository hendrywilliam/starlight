import { supabaseClient } from "../lib/supabase";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { embeddings } from "../lib/embeddings";

export const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabaseClient,
  tableName: process.env.SUPABASE_VECTOR_TABLE,
  queryName: process.env.SUPABASE_VECTOR_QUERY_NAME,
});
