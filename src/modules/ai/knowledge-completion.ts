import { pull } from "langchain/hub";
import type { Logger } from "winston";
import { ChatOpenAI } from "@langchain/openai";
import type { Document } from "langchain/document";
import type { Module } from "../../discord/types/discord";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { VectorStore } from "@langchain/core/vectorstores";

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
      const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");
      const docsContent = state.context
        .map((document) => {
          return (document as Document).pageContent;
        })
        .join();
      const messages = await promptTemplate.invoke({
        question: state.question,
        context: docsContent,
      });
      const response = await this.model.invoke(messages);
      return { answer: response.content };
    } catch (error) {
      console.error(error);
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
      console.error(error);
    }
  }
}
