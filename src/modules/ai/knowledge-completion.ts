import { pull } from "langchain/hub";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import {
  Annotation,
  StateGraph,
  type AnnotationRoot,
} from "@langchain/langgraph";
import {
  RecursiveCharacterTextSplitter,
  TextSplitter,
} from "@langchain/textsplitters";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Embeddings } from "@langchain/core/embeddings";
import type { VectorStore } from "@langchain/core/vectorstores";

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

export class KnowledgeBaseModule {
  model: BaseChatModel;
  embedding: Embeddings;
  vectorStore: VectorStore;

  splitter: TextSplitter;
  textLoader: TextLoader;
  graph: StateGraph<typeof StateAnnotation.State>;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.embedding = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
    });
    this.vectorStore = new MemoryVectorStore(this.embedding);
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    this.textLoader = new TextLoader("./test.txt");

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
      state.question
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
      const doc = await this.textLoader.load();
      const splits = await this.splitter.splitDocuments(doc);
      await this.vectorStore.addDocuments(splits);
      const result = await this.graph.invoke({
        question,
      });
      return result.answer as string;
    } catch (error) {
      console.error(error);
    }
  }
}
