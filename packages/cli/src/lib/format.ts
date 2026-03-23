import { ux } from '@oclif/core';

export interface Column<T> {
  header: string;
  key?: keyof T & string;
  get?: (row: T) => string;
  align?: 'left' | 'right';
}

export function formatTable<T>(rows: T[], columns: Column<T>[]): string {
  const getValue = (row: T, col: Column<T>): string => {
    if (col.get) return col.get(row);
    if (col.key) return String(row[col.key] ?? '');
    return '';
  };

  const widths = columns.map((col) => {
    const max = rows.reduce((w, row) => Math.max(w, stripAnsi(getValue(row, col)).length), 0);
    return Math.max(max, col.header.length);
  });

  const pad = (text: string, width: number, align?: 'left' | 'right'): string => {
    const len = stripAnsi(text).length;
    const diff = width - len;
    if (diff <= 0) return text;
    return align === 'right' ? ' '.repeat(diff) + text : text + ' '.repeat(diff);
  };

  const header = columns.map((col, i) => pad(col.header, widths[i]!, col.align)).join('   ');
  const divider = columns.map((_col, i) => '─'.repeat(widths[i]!)).join('   ');

  const body = rows.map((row) =>
    columns.map((col, i) => pad(getValue(row, col), widths[i]!, col.align)).join('   ')
  );

  return [ux.colorize('dim', header), ux.colorize('dim', divider), ...body].join('\n');
}

export function statusDot(status: string): string {
  switch (status) {
    case 'online':
      return ux.colorize('green', '●') + ' online';
    case 'offline':
      return ux.colorize('dim', '○') + ' offline';
    case 'stopped':
      return ux.colorize('red', '●') + ' stopped';
    default:
      return status;
  }
}

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = Date.parse(dateString);
  if (!Number.isFinite(then)) return dateString;

  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(then).toLocaleDateString();
}

/** Strip ANSI escape codes for width calculation */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}
