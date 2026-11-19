import { describe, expect, it } from 'vitest';
import { buildCsv, csvRowsToStories, parseCsv } from './csv.js';

describe('CSV import/export helpers', () => {
  it('parses quoted commas, escaped quotes and embedded newlines', () => {
    const rows = parseCsv('ID,Summary,Description\r\nSP-1,"A story, with comma","Line one\nLine two"\r\nSP-2,"Say ""hello""",Short');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(['SP-1', 'A story, with comma', 'Line one\nLine two']);
    expect(rows[2][1]).toBe('Say "hello"');
  });

  it('converts common Jira and CSV headers into stories', () => {
    const stories = csvRowsToStories(parseCsv('Issue Key,Summary,Description\nAPP-10,Build dashboard,Add reporting'));
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({
      idDisplay: 'APP-10',
      text: 'Build dashboard',
      descriptionDisplay: 'Add reporting',
    });
  });

  it('supports legacy ID and Description headers', () => {
    const stories = csvRowsToStories(parseCsv('Id,Description\n42,Prepare release'));
    expect(stories[0]).toMatchObject({ idDisplay: '42', text: 'Prepare release' });
  });

  it('quotes fields safely and can omit the header row', () => {
    const csv = buildCsv([['ID', 'Summary'], ['1', 'A, B'], ['2', 'Say "yes"']], false);
    expect(csv).toBe('1,"A, B"\r\n2,"Say ""yes"""');
  });
});
