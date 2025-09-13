import type { VectorStore } from "@langchain/core/vectorstores";
import type { Module } from "../../discord/types/discord";
import type { Embeddings } from "@langchain/core/embeddings";
import type { TextSplitter } from "langchain/text_splitter";
import type { Document } from "langchain/document";
import type { DocumentInterface } from "@langchain/core/documents";
import { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "winston";

export class RAGModule implements Module {
  private vectorStore: VectorStore;
  private embedding: Embeddings;
  private textSplitter: TextSplitter;
  public db: SupabaseClient;
  public logger: Logger;

  constructor(
    embedding: Embeddings,
    vectorStore: VectorStore,
    textSplitter: TextSplitter,
    db: SupabaseClient,
    logger: Logger
  ) {
    this.vectorStore = vectorStore;
    this.embedding = embedding;
    this.textSplitter = textSplitter;
    this.db = db;
    this.logger = logger;
  }

  public async splitText(text: string) {
    const contents = await this.textSplitter.splitText(text);
    return contents;
  }

  public async splitDocuments(docs: Document[]) {
    const documents = await this.textSplitter.splitDocuments(docs);
    return documents;
  }

  public async addDocuments(
    docs: DocumentInterface<Record<string, any>>[],
    options?: Record<string, any>
  ) {
    return await this.vectorStore.addDocuments(docs, options);
  }

  public async similaritySearch(
    query: string,
    k?: number,
    filter?: string | object
  ) {
    return await this.vectorStore.similaritySearch(query, k, filter);
  }

  public async asRetriever(
    ...args: Parameters<typeof this.vectorStore.asRetriever>
  ) {
    return await this.vectorStore.asRetriever(...args);
  }

  public async embedQuery(document: string) {
    return await this.embedding.embedQuery(document);
  }

  public async deleteDocuments(params?: Record<string, any>) {
    return await this.vectorStore.delete(params);
  }

  public execute() {
    return;
  }
}
