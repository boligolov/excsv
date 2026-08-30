const DELIM_NAMES: Record<string, string> = {
  comma: ',',
  tab: '\t',
  pipe: '|',
  semicolon: ';',
};

const QUOTE_NAMES: Record<string, string> = {
  none: '',
  double: '"',
  single: "'",
};

export function resolveDelim(nameOrLiteral: string | undefined): string {
  if (!nameOrLiteral || nameOrLiteral === 'comma') return ',';
  return DELIM_NAMES[nameOrLiteral] ?? nameOrLiteral;
}

export function resolveQuote(nameOrLiteral: string | undefined): string {
  if (!nameOrLiteral || nameOrLiteral === 'none') return '';
  return QUOTE_NAMES[nameOrLiteral] ?? nameOrLiteral;
}

export function delimToHeaderValue(delim: string): string {
  for (const [name, ch] of Object.entries(DELIM_NAMES)) {
    if (ch === delim) return name;
  }
  return delim;
}

export function quoteToHeaderValue(quote: string): string | undefined {
  if (!quote) return undefined;
  for (const [name, ch] of Object.entries(QUOTE_NAMES)) {
    if (ch === quote) return name;
  }
  return quote;
}

/** Parse one CSV/TSV row according to ExCSV dialect settings. */
export function parseCsvRow(line: string, delim: string, quoteChar: string): string[] {
  if (!quoteChar) {
    return splitUnquoted(line, delim);
  }

  const fields: string[] = [];
  let field = '';
  let i = 0;
  const n = line.length;

  while (true) {
    if (i >= n) {
      fields.push(field);
      break;
    }

    const ch = line[i];
    if (ch === quoteChar) {
      i++;
      while (i < n) {
        if (line[i] === quoteChar) {
          if (i + 1 < n && line[i + 1] === quoteChar) {
            field += quoteChar;
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i++];
        }
      }
      continue;
    }

    if (line.startsWith(delim, i)) {
      fields.push(field);
      field = '';
      i += delim.length;
      continue;
    }

    field += line[i++];
  }

  return fields;
}

function splitUnquoted(line: string, delim: string): string[] {
  if (!delim) return [line];
  const parts: string[] = [];
  let start = 0;
  let pos = 0;
  while (pos <= line.length) {
    if (pos === line.length || line.startsWith(delim, pos)) {
      parts.push(line.slice(start, pos));
      pos += delim.length;
      start = pos;
      if (pos > line.length) break;
    } else {
      pos++;
    }
  }
  return parts;
}

/** Serialize fields into one CSV row. */
export function serializeCsvRow(fields: string[], delim: string, quoteChar: string): string {
  if (!quoteChar) {
    return fields.join(delim);
  }
  const q = quoteChar;
  return fields
    .map((f) => {
      const needsQuote =
        f.includes(delim) || f.includes(q) || f.includes('\n') || f.includes('\r') || f.startsWith('#');
      if (!needsQuote) return f;
      return q + f.replaceAll(q, q + q) + q;
    })
    .join(delim);
}

export function splitLines(text: string): string[] {
  const normalized = text.replace(/^\uFEFF/, '');
  return normalized.split(/\r\n|\n|\r/);
}
