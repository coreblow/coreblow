import { detectMime } from "./_core-imports.js";
import { runTasksWithConcurrency } from "./_core-imports.js";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { estimateStructuredEmbeddingInputBytes } from "./embedding-input-limits.js";
import { buildTextEmbeddingInput, type EmbeddingInput } from "./embedding-inputs.js";
import { isFileMissingError } from "./fs-utils.js";
