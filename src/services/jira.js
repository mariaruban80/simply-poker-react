const jsonRequest = async (path, body) => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.errorMessages?.join(', ') || payload.error || `JIRA request failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  return payload;
};

export function normaliseJiraUrl(value) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Enter a valid http or https JIRA URL.');
  return url.origin + url.pathname.replace(/\/$/, '');
}

export async function testJiraConnection(credentials) {
  const body = {
    jiraUrl: normaliseJiraUrl(credentials.url),
    projectKey: credentials.project.trim(),
    ...(credentials.email.trim() && credentials.token ? { email: credentials.email.trim(), token: credentials.token } : {}),
  };
  const endpoint = credentials.email.trim() && credentials.token ? '/api/jira/test-token' : '/api/jira/test-anonymous';
  return jsonRequest(endpoint, body);
}

export async function searchJiraIssues(credentials, jql) {
  const payload = await jsonRequest('/api/jira/search', {
    jiraUrl: normaliseJiraUrl(credentials.url),
    projectKey: credentials.project.trim(),
    jql: jql.trim(),
    ...(credentials.email.trim() && credentials.token ? { email: credentials.email.trim(), token: credentials.token } : {}),
  });
  return (payload.issues || []).map((issue) => {
    const description = issue.fields?.description;
    const extract = (node) => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extract).filter(Boolean).join('\n');
      if (node.text) return node.text;
      return (node.content || []).map(extract).filter(Boolean).join(' ');
    };
    return {
      key: issue.key,
      summary: issue.fields?.summary || '',
      description: extract(description),
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      status: issue.fields?.status?.name || 'Unknown',
      priority: issue.fields?.priority?.name || 'Medium',
      assignee: issue.fields?.assignee?.displayName || '',
      storyPoints: issue.fields?.customfield_10016 ?? null,
      url: `${normaliseJiraUrl(credentials.url)}/browse/${issue.key}`,
    };
  });
}
