#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { supabase } from "../src/lib/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

async function main() {
  try {
    const documentsPath = path.join(import.meta.dirname, "..", "documents");
    const files = fs.readdirSync(documentsPath);
    const embeddingModel = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
      apiKey: process.env.OPENAI_API_KEY,
      dimensions: 1536,
    });
    for (const file of files) {
      const textLoader = new TextLoader(path.join(documentsPath, file));
      const documentData = await textLoader.load();
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkOverlap: 200,
        chunkSize: 1000,
      });
      const documents = await textSplitter.splitDocuments(documentData);
      const ids = documents.map((_, index) => {
        return {
          id: `${file}_chunk_${index}`,
        };
      });
      const contents = documents.map((document) => {
        return document.pageContent;
      });
      await SupabaseVectorStore.fromTexts(contents, ids, embeddingModel, {
        client: supabase,
        tableName: "documents",
        queryName: "match_documents",
      });
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
main();
