import type { CatalogModel, ModelEntry } from "./types";

export interface ScanRow {
  id: string;
  meta?: CatalogModel;
  stale: boolean;
}

export function scanRows(
  models: ModelEntry[],
  catalog: CatalogModel[],
  probedIds: string[],
): { rows: ScanRow[]; staleIds: Set<string> } {
  const upstream = new Set(probedIds);
  const staleIds = new Set(models.filter((m) => m.id.trim() !== "" && !upstream.has(m.id)).map((m) => m.id));
  const seen = new Set<string>();
  const rows: ScanRow[] = [];
  for (const id of staleIds) rows.push({ id, stale: true });
  for (const c of catalog) {
    if (!upstream.has(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    rows.push({ id: c.id, meta: c, stale: false });
  }
  for (const id of probedIds) {
    if (!seen.has(id)) rows.push({ id, stale: false });
  }
  return { rows, staleIds };
}
