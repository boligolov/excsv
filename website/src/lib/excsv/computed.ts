import type { Column } from './types';

/** A `formula=` column with no `materialized=1` has no data slot: no header cell, no field in any row, no `.col` file, no index. */
export function isVirtualColumn(col: Column): boolean {
  return col.formula !== undefined && !col.materialized;
}

/** Stored columns plus materialized computed columns, in order — the columns that actually occupy a `data[row]` slot. */
export function physicalColumns(columns: Column[] | undefined): Column[] {
  if (!columns) return [];
  return columns.filter((c) => !isVirtualColumn(c));
}

/** Assigns sequential `index` to physical columns only; strips any stray `index` from virtual ones. */
export function assignPhysicalIndexes(columns: Column[]): Column[] {
  let next = 0;
  return columns.map((col) => {
    if (isVirtualColumn(col)) {
      if (col.index === undefined) return col;
      const { index, ...rest } = col;
      return rest;
    }
    const idx = col.index ?? next;
    next = idx + 1;
    return { ...col, index: idx };
  });
}
