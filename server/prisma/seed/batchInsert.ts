import type { PoolClient } from 'pg';

// Postgres allows at most 65535 bound parameters per statement. We compute the
// rows-per-statement from the column count and stay comfortably under that.
const MAX_PARAMS = 60_000;

type BatchInsertOptions = {
  /** e.g. "ON CONFLICT DO NOTHING" */
  onConflict?: string;
};

/**
 * Insert many rows with parameterized multi-row INSERT statements, chunked to
 * respect the parameter ceiling. Values are bound (never interpolated), so text
 * escaping and array encoding are handled by the driver.
 */
export async function batchInsert(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  options: BatchInsertOptions = {},
): Promise<void> {
  if (rows.length === 0) return;

  const colList = columns.map((c) => `"${c}"`).join(', ');
  const perRow = columns.length;
  const rowsPerStatement = Math.floor(MAX_PARAMS / perRow);
  const conflict = options.onConflict ? ` ${options.onConflict}` : '';

  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    const slice = rows.slice(start, start + rowsPerStatement);
    const params: unknown[] = [];
    const tuples = slice.map((row, r) => {
      const placeholders = row.map((_, c) => `$${r * perRow + c + 1}`);
      params.push(...row);
      return `(${placeholders.join(', ')})`;
    });

    await client.query(
      `INSERT INTO "${table}" (${colList}) VALUES ${tuples.join(', ')}${conflict}`,
      params,
    );
  }
}
