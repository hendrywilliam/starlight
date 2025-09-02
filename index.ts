import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Discord } from "./src/discord/discord";
import { KnowledgeBaseModule } from "./src/modules/ai/knowledge-completion";
import { OpenAIEmbeddings } from "@langchain/openai";
import { supabase } from "./src/lib/supabase";

async function main() {
  const discord = new Discord(
    process.env.DISCORD_APP_TOKEN ?? "",
    process.env.DISCORD_APP_VERSION ?? ""
  );
  const embedding = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-large",
    dimensions: 1536,
  });
  const vectorStore = new SupabaseVectorStore(embedding, {
    client: supabase,
    tableName: "documents",
    queryName: "match_documents",
  });
  discord.addModule("kb", new KnowledgeBaseModule(vectorStore)).start();
}
main();
