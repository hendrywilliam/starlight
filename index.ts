import { logger } from "./src/lib/logger";
import { supabase } from "./src/lib/supabase";
import { Discord } from "./src/discord/discord";
import { RAGModule } from "./src/modules/ai/rag";
import { CacheModule } from "./src/modules/cache";
import { embedding } from "./src/lib/embeddings";
import { redisVectorStore } from "./src/lib/vector-store";
import { textSplitter } from "./src/lib/text-splitter";
import { supabaseVectorStore } from "./src/lib/vector-store";
import { CacheRedisAdapter, redisClient } from "./src/lib/redis";
import { KnowledgeBaseModule } from "./src/modules/ai/knowledge-completion";
import { PermissionManagerModule } from "./src/modules/permission-manager";

async function main() {
  redisClient.on("error", (err) => {
    logger.error(err);
  });
  await redisClient.connect();
  const discord = new Discord(
    process.env.DISCORD_APP_TOKEN ?? "",
    process.env.DISCORD_APP_VERSION ?? "",
    logger
  );
  discord
    .addModule("kb", new KnowledgeBaseModule(supabaseVectorStore, logger))
    .addModule(
      "rag",
      new RAGModule(
        embedding,
        supabaseVectorStore,
        textSplitter,
        supabase,
        logger
      )
    )
    .addModule(
      "permission",
      new PermissionManagerModule({
        privilegedCommands: process.env.PRIVILEGED_COMMANDS?.split(",") || [],
        privilegedRoles: process.env.ALLOWED_MEMBER_ROLE_ID?.split(",") || [],
        allowedChannels: process.env.ALLOWED_CHANNELS_ID?.split(",") || [],
        chatChannels: process.env.CHAT_AI_CHANNEL?.split(",") || [],
      })
    )
    .addModule(
      "cache",
      new CacheModule(new CacheRedisAdapter(redisClient, redisVectorStore))
    )
    .start();

  async function gracefulShutdown() {
    if (redisClient.isOpen) {
      redisClient.destroy();
      logger.info("redis connection closed.");
    }
    await discord.shutdown();
    logger.info("discord bot shutdown completed");
  }

  process.on("SIGTERM", async () => {
    await gracefulShutdown();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await gracefulShutdown();
    process.exit(0);
  });
}
main();
