import { afterEach, describe, expect, it, vi } from 'vitest';
import { normaliseJiraUrl, searchJiraIssues, testJiraConnection } from './jira.js';

afterEach(() => vi.unstubAllGlobals());

describe('JIRA integration service', () => {
  it('normalises a JIRA base URL and removes a trailing slash', () => {
    expect(normaliseJiraUrl(' https://example.atlassian.net/ ')).toBe('https://example.atlassian.net');
  });

  it('rejects non-http protocols', () => {
    expect(() => normaliseJiraUrl('javascript:alert(1)')).toThrow('valid http or https');
  });

  it('tests a token-authenticated project through the server proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(testJiraConnection({
      url: 'https://example.atlassian.net/',
      email: 'person@example.com',
      token: 'test-token',
      project: 'PROJ',
    })).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/jira/test-token', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        jiraUrl: 'https://example.atlassian.net',
        projectKey: 'PROJ',
        email: 'person@example.com',
        token: 'test-token',
      }),
    }));
  });

  it('maps JIRA issue fields and Atlassian document-format descriptions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        issues: [{
          key: 'PROJ-42',
          fields: {
            summary: 'Build a feature',
            description: { content: [{ content: [{ text: 'Acceptance criteria' }] }] },
            issuetype: { name: 'Story' },
            status: { name: 'To Do' },
            priority: { name: 'High' },
            assignee: { displayName: 'Alex' },
            customfield_10016: 5,
          },
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const issues = await searchJiraIssues({
      url: 'https://example.atlassian.net',
      project: 'PROJ',
      email: '',
      token: '',
    }, 'project = PROJ');

    expect(issues).toEqual([expect.objectContaining({
      key: 'PROJ-42',
      summary: 'Build a feature',
      description: 'Acceptance criteria',
      issueType: 'Story',
      status: 'To Do',
      priority: 'High',
      assignee: 'Alex',
      storyPoints: 5,
      url: 'https://example.atlassian.net/browse/PROJ-42',
    })]);
  });
});
