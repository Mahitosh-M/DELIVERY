#!/usr/bin/env node
// Node 24+: read-only review tool. It never imports data or connects to Firebase.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dryRunMigration } from "../src/integration/migration.ts";
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith("--"))
    throw new Error(`Required ${name} <path>`);
  return args[i + 1];
};
try {
  if (args.includes("--help")) {
    console.log(
      "Node 24+: node scripts/phase2-dry-run.mjs --backup backup.json --manifest manifest.json --catalog catalog.json\nReads all inputs and prints a review report. No network, database writes or imports.",
    );
    process.exit(0);
  }
  const inputs = await Promise.all(
    ["--backup", "--manifest", "--catalog"].map(async (name) => {
      const content = await readFile(option(name), "utf8");
      if (Buffer.byteLength(content) > 100_000_000)
        throw new Error(`${name} exceeds 100 MB`);
      return {
        value: JSON.parse(content.replace(/^\uFEFF/, "")),
        sha256: createHash("sha256").update(content).digest("hex"),
      };
    }),
  );
  const report = dryRunMigration(
    inputs[0].value,
    inputs[1].value,
    inputs[2].value,
  );
  console.log(
    JSON.stringify(
      {
        ...report,
        inputHashes: {
          backup: inputs[0].sha256,
          manifest: inputs[1].sha256,
          catalog: inputs[2].sha256,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Dry run failed");
  process.exitCode = 1;
}
