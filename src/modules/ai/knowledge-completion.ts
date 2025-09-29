import type { Logger } from "winston";
import { ChatOpenAI } from "@langchain/openai";
import type { Document } from "langchain/document";
import type { Module } from "../../discord/types/discord";
import { Annotation, StateGraph } from "@langchain/langgraph";
import type { VectorStore } from "@langchain/core/vectorstores";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

export class KnowledgeBaseModule implements Module {
  private model: BaseChatModel;
  private graph: StateGraph<typeof StateAnnotation.State>;
  public vectorStore: VectorStore;
  public logger: Logger;

  constructor(vectorStore: VectorStore, logger: Logger) {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = vectorStore;
    this.logger = logger;

    // @ts-ignore
    this.graph = new StateGraph(StateAnnotation)
      .addNode("retrieve", async (state) => await this.retrieve(state))
      .addNode("generate", async (state) => await this.generate(state))
      .addEdge("__start__", "retrieve")
      .addEdge("retrieve", "generate")
      .addEdge("generate", "__end__")
      .compile();
  }

  public async retrieve(state: typeof InputStateAnnotation.State) {
    const questionEmbedding = await this.vectorStore.embeddings.embedQuery(
      state.question
    );
    const retrievedDocs =
      await this.vectorStore.similaritySearchVectorWithScore(
        questionEmbedding,
        4
      );
    const actualContexts = retrievedDocs.map((doc) => doc[0]);
    return { context: actualContexts };
  }

  async generate(state: typeof StateAnnotation.State) {
    try {
      const contexts = state.context
        .map((document) => {
          return (document as Document).pageContent;
        })
        .join();
      const prompt = `
        You are a Retrieval-Augmented Generation (RAG) assistant. Use ONLY the documents and snippets provided in the retrieval context (labeled as {{CONTEXTS}}) to answer the user's question ({{QUESTION}}). You MAY expand, explain, and infer, but every factual claim must be linked to the context. If the answer requires information not present in {{CONTEXTS}}, do NOT hallucinate. If the user asked for up-to-date facts but those are not in {{CONTEXTS}}, just answer "This is beyond my knowledge". Always answer in English/Bahasa Indonesia. Use markdown format. Remove emojis.
        QUESTION:
        ${state.question}
        CONTEXTS:
        ${contexts}
      `;
      const response = await this.model.invoke(prompt);
      return { answer: response.content };
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async execute(question: string) {
    try {
      // @ts-ignore - Graph has invoke method.
      const result = await this.graph.invoke({
        question,
      });
      return result.answer as string;
    } catch (error) {
      this.logger.error(error);
    }
  }
}
