import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const API_SOURCE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../api.ts");

function collectExportedNames(): Set<string> {
  const source = ts.createSourceFile(
    API_SOURCE_PATH,
    readFileSync(API_SOURCE_PATH, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.add(declaration.name.text);
        }
      }
      continue;
    }
    if (!ts.isExportDeclaration(statement) || !statement.exportClause) {
      continue;
    }
    if (ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        names.add(element.name.text);
      }
    }
  }
  return names;
}

function collectWildcardReExportModules(): Set<string> {
  const source = ts.createSourceFile(
    API_SOURCE_PATH,
    readFileSync(API_SOURCE_PATH, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const modules = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!statement.exportClause && statement.moduleSpecifier) {
      // bare "export * from '...'" without named clause
      modules.add((statement.moduleSpecifier as ts.StringLiteral).text);
    }
  }
  return modules;
}

describe("discord API barrel", () => {
  it("exports current internal entrypoints", () => {
    const exportedNames = collectExportedNames();

    for (const exportName of [
      "DiscordSendResult",
      "DiscordSendComponents",
      "DiscordSendEmbeds",
      "resolveDiscordRuntimeGroupPolicy",
    ]) {
      expect(exportedNames).toContain(exportName);
    }
  });

  it("re-exports from expected internal modules", () => {
    const modules = collectWildcardReExportModules();

    for (const mod of [
      "./src/account-inspect.js",
      "./src/accounts.js",
      "./src/actions/handle-action.guild-admin.js",
      "./src/actions/handle-action.js",
      "./src/components.js",
      "./src/probe.js",
      "./src/group-policy.js",
    ]) {
      expect(modules).toContain(mod);
    }
  });
});
