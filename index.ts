import { Discord } from "./src/discord/discord";
import { KnowledgeBaseModule } from "./src/modules/ai/knowledge-completion";

async function main() {
  const discord = new Discord(
    process.env.DISCORD_APP_TOKEN ?? "",
    process.env.DISCORD_APP_VERSION ?? ""
  );
  discord.addModule("kb", new KnowledgeBaseModule()).start();
}
main();
