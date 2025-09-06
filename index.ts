import { Discord } from "./src/discord/discord";
import { KnowledgeBaseModule } from "./src/modules/ai/knowledge-completion";
import { OpenAIEmbeddings } from "@langchain/openai";
import { vectorStore } from "./src/lib/vector-store";

async function main() {
  const discord = new Discord(
    process.env.DISCORD_APP_TOKEN ?? "",
    process.env.DISCORD_APP_VERSION ?? "",
    vectorStore
  );
  const embedding = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-large",
    dimensions: 1536,
  });
  discord.addModule("kb", new KnowledgeBaseModule(vectorStore)).start();
}
main();
