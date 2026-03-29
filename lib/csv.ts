function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const serialized =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);

  if (!/[",\n\r]/.test(serialized)) {
    return serialized;
  }

  return `"${serialized.replace(/"/g, '""')}"`;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  explicitHeaders?: string[]
): string {
  const headers =
    explicitHeaders && explicitHeaders.length > 0
      ? explicitHeaders
      : Array.from(
          rows.reduce((set, row) => {
            for (const key of Object.keys(row)) {
              set.add(key);
            }
            return set;
          }, new Set<string>())
        );

  const headerLine = headers.map((header) => escapeCsvValue(header)).join(",");
  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header])).join(",")
  );

  return `${[headerLine, ...bodyLines].join("\n")}\n`;
}
