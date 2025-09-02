import { Router } from "express";
import type { Request, Response } from "express";
import {
  addDocuments,
  deleteDocuments,
  getDocuments,
} from "../services/vector";
import { textSplitter } from "../lib/text-splitter";
import { Document } from "@langchain/core/documents";

const router = Router();

router.post("/document/new", async (req: Request, res: Response) => {
  try {
    const { body } = req;
    const splitted = await textSplitter.splitText(body.content);
    const documents = splitted.map((item, i) => {
      return {
        pageContent: item,
        metadata: {},
        id: i.toString(),
      } satisfies Document;
    });
    const results = await addDocuments(documents);
    res.status(201).json({
      messages: "Documents added successfully.",
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.delete("/document/delete", async (req, res) => {
  try {
    const { body } = req;
    await deleteDocuments(body.ids);
    res.status(200).json({
      messages: "Documents deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/document/list", async (req, res) => {
  try {
    const { body } = req;
    const result = await getDocuments(body.query, body.k, body.filter || {});
    res.status(200).json({
      messages: "Documents retrieved successfully.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
