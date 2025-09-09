import { Discord } from "./src/discord/discord";
import { KnowledgeBaseModule } from "./src/modules/ai/knowledge-completion";
import { RAGModule } from "./src/modules/ai/rag";
import { embeddings } from "./src/lib/embeddings";
import { vectorStore } from "./src/lib/vector-store";
import { textSplitter } from "./src/lib/text-splitter";
import { supabase } from "./src/lib/supabase";

async function main() {
  const discord = new Discord(
    process.env.DISCORD_APP_TOKEN ?? "",
    process.env.DISCORD_APP_VERSION ?? ""
  );
  discord
    .addModule("kb", new KnowledgeBaseModule(vectorStore))
    .addModule(
      "rag",
      new RAGModule(embeddings, vectorStore, textSplitter, supabase)
    )
    .start();

  process.on("SIGTERM", async () => {
    await discord.shutdown();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await discord.shutdown();
    process.exit(0);
  });
}
main();
