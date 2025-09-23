#!/usr/bin/env bun
import { SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from "redis";
import { redisClient } from "../src/lib/redis";

/**
 * Script to run index creation for the first time.
 */

async function main() {
  await redisClient.connect();
  try {
    await redisClient.ft.dropIndex("vector_idx");
  } catch (error) {}
  try {
    await redisClient.ft.create(
      "vector_idx",
      {
        content: {
          type: SCHEMA_FIELD_TYPE.TEXT,
        },
        /**
         * Tag fields are used to provide exact match search capabilities with high performance and memory efficiency.
         * Use this to filter docs without leveraging full-text search.
         */
        id: {
          type: SCHEMA_FIELD_TYPE.TAG,
        },
        parent_id: {
          type: SCHEMA_FIELD_TYPE.TAG,
        },
        channel_id: {
          type: SCHEMA_FIELD_TYPE.TAG,
        },
        attachment_id: {
          type: SCHEMA_FIELD_TYPE.TAG,
        },
        attachment_name: {
          type: SCHEMA_FIELD_TYPE.TAG,
        },
        embedding: {
          type: SCHEMA_FIELD_TYPE.VECTOR,
          TYPE: "FLOAT32",
          ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.FLAT,
          DISTANCE_METRIC: "L2",
          /**
           * Match embedding model.
           */
          DIM: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS!, 10),
        },
      },
      {
        ON: "HASH",
        PREFIX: "document:",
      }
    );
    console.log("Index created.");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
}
main();
