import { parseKvPairs, serializeKvPairs } from './kv';
import type { Chart, Column, ConvertWarning } from './types';

/** Spec: docs/implementation/charts.md */

const CHANNELS = new Set([
  'x', 'y', 'x2', 'y2', 'color', 'size', 'theta', 'radius', 'shape', 'opacity',
  'column', 'row', 'detail', 'order', 'tooltip', 'text',
]);
const MODIFIERS = new Set(['title', 'aggregate', 'bin', 'stack', 'sort', 'limit', 'hole']);

/** Required channels per mark; each inner array is "at least one of". */
const REQUIRED: Record<string, string[][]> = {
  bar: [['x'], ['y']],
  line: [['x'], ['y']],
  area: [['x'], ['y']],
  point: [['x', 'y']],
  circle: [['x'], ['y']],
  arc: [['theta']],
  rect: [['x'], ['y'], ['color']],
  tick: [['x', 'y']],
  boxplot: [['x', 'y']],
  text: [['x'], ['y'], ['text']],
  sparkline: [['y']],
};

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

function typedModifier(key: string, value: string): unknown {
  switch (key) {
    case 'bin':
      return value === '1' ? true : value === '0' ? false : /^\d+$/.test(value) ? Number(value) : value;
    case 'stack':
      return value === '1' ? true : value === '0' ? false : value;
    case 'limit':
      return /^\d+$/.test(value) ? Number(value) : value;
    case 'hole': {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    case 'tooltip':
      return value.includes(',') ? value.split(',') : value;
    default:
      return value;
  }
}

/** Parse the body of a `#chart` or `#chart-<engine>:` line (everything after `#chart`). */
export function parseChartLine(rest: string, warnings: ConvertWarning[]): Chart | null {
  if (rest.startsWith('-')) {
    const colon = rest.indexOf(':');
    const engine = rest.slice(1, colon === -1 ? undefined : colon);
    if (engine !== 'vega') {
      warnings.push({ code: 'chart_unknown_type', message: `Unknown chart engine #chart-${engine}: ignored.` });
      return null;
    }
    try {
      return { vega: JSON.parse(rest.slice(colon + 1)) };
    } catch {
      fail('chart_vega_invalid_json', '#chart-vega: payload is not valid JSON.');
    }
  }

  const raw = parseKvPairs(rest.trim());
  if (!raw.type) fail('chart_missing_type', '#chart line lacks type=.');
  if (!raw.name) fail('chart_missing_name', '#chart line lacks name=.');
  const chart: Chart = {};
  for (const [key, value] of Object.entries(raw)) {
    chart[key] = MODIFIERS.has(key) ? typedModifier(key, value) : value;
  }
  return chart;
}

/** Validate charts against the table's columns; throws on FAIL codes, returns WARN codes. */
export function validateCharts(charts: Chart[], columns: Column[]): ConvertWarning[] {
  const warnings: ConvertWarning[] = [];
  const names = new Set(columns.map((c) => c.name).filter(Boolean));
  const seen = new Set<string>();

  for (const chart of charts) {
    if ('vega' in chart) continue;
    const name = String(chart.name);
    const type = String(chart.type);

    for (const [key, value] of Object.entries(chart)) {
      if (key === 'type' || key === 'name' || MODIFIERS.has(key)) continue;
      if (!CHANNELS.has(key)) {
        warnings.push({ code: 'chart_unknown_channel', message: `#chart ${name}: unknown attribute ${key}= ignored.` });
        continue;
      }
      for (const ref of Array.isArray(value) ? value : [value]) {
        if (ref !== 'count()' && !names.has(String(ref))) {
          fail('chart_unknown_column', `#chart ${name}: ${key}=${ref} is not a declared #column.`);
        }
      }
    }

    const required = REQUIRED[type];
    if (!required) {
      warnings.push({ code: 'chart_unknown_type', message: `#chart ${name}: unknown type=${type}, kept as-is.` });
    } else {
      for (const anyOf of required) {
        if (!anyOf.some((ch) => ch in chart)) {
          fail('chart_missing_required_channel', `#chart ${name}: type=${type} needs ${anyOf.join(' or ')}.`);
        }
      }
    }

    if (seen.has(name)) {
      warnings.push({ code: 'chart_duplicate_name', message: `Two #chart lines named ${name}; the last one wins.` });
    }
    seen.add(name);
  }
  return warnings;
}

function textValue(value: unknown): string {
  if (value === true) return '1';
  if (value === false) return '0';
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

export function formatChartLine(chart: Chart): string {
  if ('vega' in chart) return `#chart-vega: ${JSON.stringify(chart.vega)}`;
  const { type, name, ...rest } = chart;
  const pairs: Record<string, string | undefined> = { type: textValue(type), name: textValue(name) };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null) pairs[key] = textValue(value);
  }
  return `#chart ${serializeKvPairs(pairs)}`;
}
