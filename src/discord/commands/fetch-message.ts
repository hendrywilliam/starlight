import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { RAGModule } from "../../modules/rag";
import type { DocumentChunkMetadata, Module } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("fetch")
    .setDescription(
      "Privileged command. Fetch a message/messages and store it to database."
    )
    .addChannelOption((option) => {
      option
        .setName("channel")
        .setDescription("The channel where the message(s) is located.")
        .addChannelTypes(ChannelType.PublicThread)
        .addChannelTypes(ChannelType.PrivateThread)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);
      return option;
    })
    .addStringOption((option) => {
      option
        .setName("message_id")
        .setDescription("Message IDs to fetch.")
        .setRequired(true);
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>
  ) {
    await interaction.reply(
      "Beep boop beep boop. Fetching selected message..."
    );
    const messageIds = interaction.options.getString("message_id") as string;
    const channel = interaction.options.getChannel("channel");
    if (!channel) throw new Error("Failed to fetch channel data.");
    const actualChannel = await interaction.client.channels.fetch(channel.id);
    if (!actualChannel) throw new Error("Failed to get channel data.");
    if (!actualChannel.isThread() && !actualChannel.isTextBased()) {
      return await interaction.editReply(
        "You have selected the wrong type of channel. Fetch only accept a thread/text based channel."
      );
    }
    const messages = (
      await Promise.all(
        messageIds.split(",").map((id) => {
          return actualChannel.messages.fetch(id);
        })
      )
    ).filter(Boolean);
    const ragModule = module.get("rag") as RAGModule | undefined;
    if (!ragModule) throw new Error("Failed to get dependency module.");
    const contents = await ragModule.splitText(
      messages
        .map((message) => {
          return message.content;
        })
        .join("")
    );
    const rows = await Promise.all(
      contents.map(async (item, index) => {
        const vectorFromQuery = await ragModule.embedQuery(item);
        return {
          content: item,
          metadata: {
            id: `${messages[0]?.id}_chunk_${index}`,
            parent_id: messages[0]?.id || "",
            channel_id: actualChannel.id,
          } satisfies DocumentChunkMetadata,
          embedding: vectorFromQuery,
        };
      })
    );
    // Get attachments.
    for (const message of messages) {
      for (const attachment of message.attachments.values()) {
        const mimeType = attachment.contentType
          ? attachment.contentType.split(";")[0]
          : "";
        if (mimeType === "text/plain") {
          try {
            const response = await fetch(attachment.url, {
              method: "GET",
            });
            const textContent = await response.text();
            const attachmentContents = await ragModule.splitText(textContent);
            const attachmentRows = await Promise.all(
              attachmentContents.map(async (item, index) => {
                const vectorFromQuery = await ragModule.embedQuery(item);
                return {
                  content: item,
                  metadata: {
                    channel_id: actualChannel.id,
                    id: `${message.id}_chunk_${index}`,
                    parent_id: message.id,
                    is_attachment: true,
                    attachment_id: attachment.id,
                    attachment_name: attachment.name,
                  } satisfies DocumentChunkMetadata,
                  embedding: vectorFromQuery,
                };
              })
            );
            rows.push(...attachmentRows);
          } catch (error) {
            console.error(
              `Error while processing thread/message attachments ${attachment.id}: `,
              error
            );
          }
        }
        continue;
      }
    }
    await ragModule.db.from("documents").insert(rows);
    await interaction.editReply("Fetch message succeded.");
  },
};
