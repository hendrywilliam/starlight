import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { embedding } from "./embeddings";
import { supabase } from "./supabase";
import { SCHEMA_VECTOR_FIELD_ALGORITHM } from "redis";
import {
  RedisVectorStore,
  type CreateSchemaHNSWVectorField,
} from "@langchain/redis";
import { redisClient } from "./redis";

export const supabaseVectorStore = new SupabaseVectorStore(embedding, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

export const redisVectorStore = new RedisVectorStore(embedding, {
  // @ts-expect-error - Redis client has different type but still usable.
  redisClient,
  indexName: "vector_idx",
  indexOptions: {
    ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW,
    DISTANCE_METRIC: "L2",
  } as CreateSchemaHNSWVectorField,
  contentKey: "content",
  vectorKey: "embedding",
  keyPrefix: "doc:vector_idx",
});
