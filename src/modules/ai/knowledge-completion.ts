import { pull } from "langchain/hub";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { VectorStore } from "@langchain/core/vectorstores";
import type { Document } from "langchain/document";
import type { Module } from "../../discord/types/discord";

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

export class KnowledgeBaseModule implements Module {
  model: BaseChatModel;
  vectorStore: VectorStore;
  graph: StateGraph<typeof StateAnnotation.State>;

  constructor(vectorStore: VectorStore) {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = vectorStore;

    // @ts-ignore
    this.graph = new StateGraph(StateAnnotation)
      .addNode("retrieve", async (state) => await this._retrieve(state))
      .addNode("generate", async (state) => await this._generate(state))
      .addEdge("__start__", "retrieve")
      .addEdge("retrieve", "generate")
      .addEdge("generate", "__end__")
      .compile();
  }

  private async _retrieve(state: typeof InputStateAnnotation.State) {
    const retrievedDocs = await this.vectorStore.similaritySearch(
      state.question,
      1
    );
    return { context: retrievedDocs };
  }

  private async _generate(state: typeof StateAnnotation.State) {
    try {
      const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");
      const docsContent = state.context
        .map((document) => (document as Document).pageContent)
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
