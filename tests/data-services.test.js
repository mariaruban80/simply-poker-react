import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseCsv, csvRowsToStories, buildCsv, escapeCsv } from '../src/services/csv.js';
import { normaliseJiraUrl, searchJiraIssues } from '../src/services/jira.js';

describe('CSV import and export', () => {
  it('parses quoted commas, escaped quotes and line breaks', () => {
    expect(parseCsv('ID,Summary,Description\r\nSP-1,"Login, securely","Line one\nLine two"\r\nSP-2,"Say ""hello""",Done')).toEqual([
      ['ID','Summary','Description'],
      ['SP-1','Login, securely','Line one\nLine two'],
      ['SP-2','Say "hello"','Done'],
    ]);
  });

  it('parses tab-delimited files and removes a UTF-8 BOM', () => {
    expect(parseCsv('\uFEFFID\tSummary\nSP-1\tFirst story')).toEqual([
      ['ID','Summary'],['SP-1','First story'],
    ]);
  });

  it('maps imported stories while retaining ID and description', () => {
    const stories = csvRowsToStories([
      ['Key','Summary','Description'],
      ['APP-42','Reset password','Allow a user to reset a forgotten password'],
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({
      id: 'story_csv_APP-42_0',
      idDisplay: 'APP-42',
      text: 'Reset password',
      descriptionDisplay: 'Allow a user to reset a forgotten password',
      points: '?',
    });
  });

  it('escapes CSV cells and preserves embedded newlines', () => {
    expect(escapeCsv('  a,"b"\nc  ')).toBe('"  a,""b""\nc  "');
    expect(buildCsv([['ID','Summary'],['1','A, B']], true)).toBe('ID,Summary\r\n1,"A, B"');
    expect(buildCsv([['ID','Summary'],['1','A, B']], false)).toBe('1,"A, B"');
  });
});

describe('JIRA integration service', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalises a JIRA base URL without trailing slash', () => {
    expect(normaliseJiraUrl(' https://example.atlassian.net/ ')).toBe('https://example.atlassian.net');
    expect(normaliseJiraUrl('https://jira.example.com/jira/')).toBe('https://jira.example.com/jira');
  });

  it('rejects invalid and non-http JIRA URLs', () => {
    expect(() => normaliseJiraUrl('not a url')).toThrow();
    expect(() => normaliseJiraUrl('javascript:alert(1)')).toThrow('http or https');
  });

  it('maps JIRA issue fields, including Atlassian rich-text descriptions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        issues: [{
          key: 'APP-42',
          fields: {
            summary: 'Reset password',
            description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Forgotten password flow' }] }] },
            issuetype: { name: 'Story' },
            status: { name: 'To Do' },
            priority: { name: 'High' },
            assignee: { displayName: 'Test User' },
            customfield_10016: 5,
          },
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const issues = await searchJiraIssues({
      url: 'https://example.atlassian.net/', project: 'APP', email: 'test@example.com', token: 'secret',
    }, 'project = APP');
    expect(issues[0]).toMatchObject({
      key: 'APP-42',
      summary: 'Reset password',
      description: 'Forgotten password flow',
      issueType: 'Story',
      status: 'To Do',
      priority: 'High',
      assignee: 'Test User',
      storyPoints: 5,
      url: 'https://example.atlassian.net/browse/APP-42',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/jira/search', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"token":"secret"'),
    }));
  });
});
