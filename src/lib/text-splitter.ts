import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkOverlap: 200,
  chunkSize: 1000,
});

/**
 * Chunk size 1500 is for discord message limit.
 * With no overlapping contents between each splitted texts.
 */
export const responseSplitter = new RecursiveCharacterTextSplitter({
  chunkOverlap: 0,
  chunkSize: 1500,
});
