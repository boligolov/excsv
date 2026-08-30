/** Parse space-separated key=value pairs (ExCSV header / #column attributes). */
export function parseKvPairs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  const n = input.length;

  while (i < n) {
    while (i < n && input[i] === ' ') i++;
    if (i >= n) break;

    const eq = input.indexOf('=', i);
    if (eq === -1) break;

    const key = input.slice(i, eq);
    i = eq + 1;

    if (i < n && input[i] === '"') {
      i++;
      let val = '';
      while (i < n) {
        if (input[i] === '"') {
          if (i + 1 < n && input[i + 1] === '"') {
            val += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          val += input[i++];
        }
      }
      result[key] = val;
    } else {
      let j = i;
      while (j < n && input[j] !== ' ') j++;
      result[key] = input.slice(i, j);
      i = j;
    }
  }

  return result;
}

export function formatKvValue(value: string): string {
  if (/[\s"]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeKvPairs(pairs: Record<string, string | undefined>): string {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${formatKvValue(v!)}`)
    .join(' ');
}
