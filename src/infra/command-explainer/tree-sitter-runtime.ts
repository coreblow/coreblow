export function resolvePackageFileForCommandExplanation(
  packageName: string,
  fileName: string,
): string {
  throw new Error(
    `Tree-sitter command explanation is not bundled in CoreBlow lightweight mode: ${packageName}/${fileName}`,
  );
}

export async function getBashParserForCommandExplanation(): Promise<never> {
  throw new Error("Tree-sitter command explanation is not bundled in CoreBlow lightweight mode");
}

export function setBashParserLoaderForCommandExplanationForTest(): void {
  // Lightweight CoreBlow command explanation does not use a parser loader.
}

export async function parseBashForCommandExplanation(): Promise<never> {
  throw new Error("Tree-sitter command explanation is not bundled in CoreBlow lightweight mode");
}
