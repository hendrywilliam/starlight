import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkOverlap: 200,
  chunkSize: 1000,
});
