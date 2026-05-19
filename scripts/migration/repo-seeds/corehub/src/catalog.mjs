const entryKinds = new Set(["skill", "plugin", "provider", "channel"]);

export function validateCatalogEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return ["entry must be an object"];
  }
  if (typeof entry.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
    errors.push("id must be kebab-case");
  }
  if (!entryKinds.has(entry.kind)) {
    errors.push(`kind must be one of ${[...entryKinds].join(", ")}`);
  }
  if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
    errors.push("name is required");
  }
  if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) {
    errors.push("summary is required");
  }
  if (typeof entry.source !== "string" || !entry.source.startsWith("https://github.com/")) {
    errors.push("source must be a GitHub URL");
  }
  return errors;
}

export function validateCatalog(entries) {
  if (!Array.isArray(entries)) {
    return ["catalog must be an array"];
  }
  const ids = new Set();
  const errors = [];
  for (const [index, entry] of entries.entries()) {
    for (const error of validateCatalogEntry(entry)) {
      errors.push(`entries[${index}]: ${error}`);
    }
    if (entry?.id) {
      if (ids.has(entry.id)) {
        errors.push(`entries[${index}]: duplicate id ${entry.id}`);
      }
      ids.add(entry.id);
    }
  }
  return errors;
}
