import { Document } from "@langchain/core/documents";
import { vectorStore } from "../lib/vector-store";

export const addDocuments = async function (
  documents: Document[],
  options?: { ids?: string[] | number[] }
): Promise<string[]> {
  return await vectorStore.addDocuments(documents, options);
};

export const getDocuments = async function (
  query: string,
  similarResultCount: number,
  filter: any
) {
  return await vectorStore.similaritySearch(query, similarResultCount, filter);
};

export const deleteDocuments = async function (ids: string[] | number[]) {
  return await vectorStore.delete({
    ids,
  });
};
