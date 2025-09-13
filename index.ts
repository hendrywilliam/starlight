import { Discord } from "./src/discord/discord";
import { KnowledgeBaseModule } from "./src/modules/ai/knowledge-completion";
import { RAGModule } from "./src/modules/ai/rag";
import { embeddings } from "./src/lib/embeddings";
import { vectorStore } from "./src/lib/vector-store";
import { textSplitter } from "./src/lib/text-splitter";
import { supabase } from "./src/lib/supabase";
import { PermissionManager } from "./src/modules/permission-manager";
import { logger } from "./src/lib/logger";

async function main() {
  const discord = new Discord(
    process.env.DISCORD_APP_TOKEN ?? "",
    process.env.DISCORD_APP_VERSION ?? "",
    logger
  );
  discord
    .addModule("kb", new KnowledgeBaseModule(vectorStore, logger))
    .addModule(
      "rag",
      new RAGModule(embeddings, vectorStore, textSplitter, supabase, logger)
    )
    .addModule(
      "permission",
      new PermissionManager({
        privilegedCommands: process.env.PRIVILEGED_COMMANDS?.split(",") || [],
        privilegedRoles: process.env.ALLOWED_MEMBER_ROLE_ID?.split(",") || [],
        allowedChannels: process.env.ALLOWED_CHANNELS_ID?.split(",") || [],
      })
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
