import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Link2, Search, Upload, X } from 'lucide-react';
import { buildCsv, csvRowsToStories, parseCsv } from '../services/csv.js';
import { searchJiraIssues, testJiraConnection } from '../services/jira.js';

const savedJiraDetails = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('jiraConnectionDetails') || '{}');
    return { url: saved.url || '', email: saved.email || '', project: saved.project || '', token: '' };
  } catch {
    return { url: '', email: '', project: '', token: '' };
  }
};

function downloadCsv(content, filename) {
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DataImportExport({ canManage, tickets, votesPerStory, revealedStories, onImportStories, onNotice }) {
  const [modal, setModal] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvStories, setCsvStories] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [useFirstRowAsHeaders, setUseFirstRowAsHeaders] = useState(true);
  const [csvMapping, setCsvMapping] = useState({ id: '', summary: '', description: '', estimate: '', link: '' });
  const [csvError, setCsvError] = useState('');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [detailedVotes, setDetailedVotes] = useState(true);
  const [onlyRevealed, setOnlyRevealed] = useState(false);
  const [credentials, setCredentials] = useState(savedJiraDetails);
  const [jql, setJql] = useState('');
  const [jiraIssues, setJiraIssues] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [jiraStatus, setJiraStatus] = useState('');
  const [jiraBusy, setJiraBusy] = useState(false);

  const visibleIssues = useMemo(() => jiraIssues.filter((issue) =>
    (!statusFilter || issue.status === statusFilter)
    && (!typeFilter || issue.issueType === typeFilter)
    && (!searchText || `${issue.key} ${issue.summary}`.toLowerCase().includes(searchText.toLowerCase()))
  ), [jiraIssues, statusFilter, typeFilter, searchText]);

  const csvHeaders = useFirstRowAsHeaders ? (csvRows[0] || []).map((value, index) => String(value || '').trim() || `Column ${index + 1}`) : (csvRows[0] || []).map((_, index) => `Column ${index + 1}`);
  const csvDataRows = useFirstRowAsHeaders ? csvRows.slice(1) : csvRows;
  const csvMappingOptions = Object.entries(csvMapping).map(([field, selected]) => ({ field, selected }));
  const statusOptions = [...new Set(jiraIssues.map((issue) => issue.status))];
  const typeOptions = [...new Set(jiraIssues.map((issue) => issue.issueType))];

  if (!canManage) return null;

  function closeModal() {
    setModal('');
    setCsvError('');
    setJiraStatus('');
  }

  async function readCsv(file) {
    setCsvFile(file); setCsvError(''); setCsvStories([]);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length || !rows.some((row) => row.some((cell) => String(cell).trim()))) throw new Error('The selected CSV file is empty.');
      setCsvRows(rows);
      const headers = rows[0].map((value) => String(value || '').toLowerCase().trim());
      const find = (names) => headers.findIndex((value) => names.includes(value.replace(/[ _-]/g, '')));
      setCsvMapping({
        id: String(find(['id','key','issuekey','ticketid']) >= 0 ? find(['id','key','issuekey','ticketid']) : ''),
        summary: String(find(['summary','title','name','story']) >= 0 ? find(['summary','title','name','story']) : (rows[0].length > 1 ? 1 : 0)),
        description: String(find(['description','details']) >= 0 ? find(['description','details']) : ''),
        estimate: String(find(['estimate','storypoints','points']) >= 0 ? find(['estimate','storypoints','points']) : ''),
        link: String(find(['link','url','issueurl']) >= 0 ? find(['link','url','issueurl']) : ''),
      });
      setUseFirstRowAsHeaders(true);
    } catch (error) {
      setCsvRows([]); setCsvStories([]);
      setCsvError(error.message || 'Unable to read this CSV file.');
    }
  }

  function buildMappedCsvStories() {
    const indexes = Object.fromEntries(Object.entries(csvMapping).map(([key, value]) => [key, value === '' ? -1 : Number(value)]));
    return csvDataRows.map((row, index) => {
      const get = (key) => indexes[key] >= 0 ? String(row[indexes[key]] || '').trim() : '';
      const summary = get('summary') || get('description');
      if (!summary) return null;
      const idDisplay = get('id');
      return {
        id: 'story_csv_' + (idDisplay || Date.now() + '_' + index).replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + index,
        idDisplay, text: summary, title: summary,
        descriptionDisplay: get('description') && get('description') !== summary ? get('description') : '',
        points: get('estimate') || '?', jiraUrl: get('link') || '',
        originalText: summary, originalLang: 'en',
      };
    }).filter(Boolean);
  }

  function importCsv() {
    const stories = buildMappedCsvStories();
    if (!stories.length) { setCsvError('No usable stories found. Check the Summary mapping and selected rows.'); return; }
    onImportStories(stories);
    onNotice?.(`Imported ${stories.length} CSV stories.`);
    closeModal(); setCsvFile(null); setCsvRows([]); setCsvStories([]);
  }

  function exportStories() {
    const stories = tickets.filter((story) => !onlyRevealed || revealedStories[story.id]);
    if (!stories.length) {
      onNotice?.(onlyRevealed ? 'There are no revealed stories to export.' : 'There are no stories to export.');
      return;
    }
    const header = ['ID', 'Title', 'Description', 'Story Points', 'Vote Count', 'Average Vote'];
    if (detailedVotes) header.push('Votes');
    const rows = [header];
    stories.forEach((story) => {
      const votes = Object.values(votesPerStory[story.id] || {});
      const numericVotes = votes.map(Number).filter(Number.isFinite);
      const average = numericVotes.length ? (numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length).toFixed(2) : '';
      const row = [
        story.idDisplay || story.id,
        story.text || story.title || '',
        story.descriptionDisplay || '',
        story.points || '?',
        votes.length,
        average,
      ];
      if (detailedVotes) row.push(votes.map(String).join('; '));
      rows.push(row);
    });
    downloadCsv(buildCsv(rows, includeHeader), `simply-poker-export-${new Date().toISOString().slice(0, 10)}.csv`);
    onNotice?.(`Exported ${stories.length} stories to CSV.`);
    closeModal();
  }

  function updateCredential(field, value) {
    setCredentials((old) => ({ ...old, [field]: value }));
  }

  async function connectJira() {
    setJiraBusy(true);
    setJiraStatus('');
    try {
      await testJiraConnection(credentials);
      localStorage.setItem('jiraConnectionDetails', JSON.stringify({
        url: credentials.url.trim(), email: credentials.email.trim(), project: credentials.project.trim(),
      }));
      setJiraStatus('Connection successful. You can now search for issues.');
    } catch (error) {
      setJiraStatus(error.message || 'Could not connect to JIRA.');
    } finally {
      setJiraBusy(false);
    }
  }

  async function runJiraSearch(event) {
    event?.preventDefault();
    if (!credentials.url.trim() || !credentials.project.trim()) {
      setJiraStatus('Enter your JIRA URL and project key first.');
      return;
    }
    setJiraBusy(true);
    setJiraStatus('');
    try {
      const issues = await searchJiraIssues(credentials, jql || `project = ${credentials.project.trim()} ORDER BY created DESC`);
      setJiraIssues(issues);
      setSelectedKeys([]);
      setStatusFilter('');
      setTypeFilter('');
      setJiraStatus(`Found ${issues.length} issues.`);
    } catch (error) {
      setJiraStatus(error.message || 'JIRA search failed.');
    } finally {
      setJiraBusy(false);
    }
  }

  function importJiraSelection() {
    const selected = jiraIssues.filter((issue) => selectedKeys.includes(issue.key));
    const imported = selected.map((issue) => ({
      id: issue.key,
      idDisplay: issue.key,
      text: issue.summary,
      descriptionDisplay: issue.description,
      originalText: issue.summary,
      originalLang: 'en',
      points: issue.storyPoints ?? '?',
      jiraUrl: issue.url,
    }));
    onImportStories(imported);
    onNotice?.(`Imported ${imported.length} JIRA issues.`);
    closeModal();
  }

  return (
    <>
      <div className="data-tools">
        <button type="button" onClick={() => { setModal('csv'); setCsvError(''); }}><Upload size={15} /> Import CSV</button>
        <button type="button" onClick={() => setModal('export')}><Download size={15} /> Export CSV</button>
        <button type="button" onClick={() => { setModal('jira'); setJiraStatus(''); }}><Link2 size={15} /> Import from JIRA</button>
      </div>

      {modal && <div className="data-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <section className="data-modal" role="dialog" aria-modal="true" aria-labelledby="data-modal-title">
          <header className="data-modal-header">
            <div>
              <p className="eyebrow">SIMPLY POKER DATA TOOLS</p>
              <h2 id="data-modal-title">{modal === 'csv' ? 'Import stories from CSV' : modal === 'export' ? 'Export session to CSV' : 'Import stories from JIRA'}</h2>
            </div>
            <button type="button" className="data-modal-close" onClick={closeModal} aria-label="Close"><X size={19} /></button>
          </header>

          {modal === 'csv' && <div className="data-modal-body">
            <p className="data-help">Choose a CSV file. The preview below lets you check the stories before adding them to this session. Quoted commas and line breaks are supported.</p>
            <label className="file-picker"><FileSpreadsheet size={19} /><span>{csvFile?.name || 'Choose a CSV file'}</span><input type="file" accept=".csv,text/csv,.txt" onChange={(event) => event.target.files?.[0] && readCsv(event.target.files[0])} /></label>
            {csvRows.length > 0 && <>
              <label className="data-check"><input type="checkbox" checked={useFirstRowAsHeaders} onChange={(event) => setUseFirstRowAsHeaders(event.target.checked)} /> Use first row as column headings</label>
              <div className="csv-mapping-grid">{[['summary','Summary (required)'],['id','Key / ID'],['description','Description'],['link','Link'],['estimate','Estimate']].map(([key,label])=><label key={key}>{label}<select value={csvMapping[key]} onChange={(event)=>setCsvMapping(old=>({...old,[key]:event.target.value}))}><option value="">Do not import</option>{csvHeaders.map((header,index)=><option key={index} value={index}>{header}</option>)}</select></label>)}</div>
              <p className="data-count">{buildMappedCsvStories().length} stories ready to import</p>
              <div className="data-preview-table"><table><thead><tr><th>ID</th><th>Story</th><th>Description</th><th>Estimate</th></tr></thead><tbody>{buildMappedCsvStories().slice(0,8).map(story=><tr key={story.id}><td>{story.idDisplay||'—'}</td><td>{story.text}</td><td>{story.descriptionDisplay||'—'}</td><td>{story.points}</td></tr>)}</tbody></table></div>
            </>}
            {csvError && <p className="data-error" role="alert">{csvError}</p>}

            <div className="data-modal-actions"><button type="button" className="data-secondary" onClick={closeModal}>Cancel</button><button type="button" className="data-primary" disabled={!csvRows.length || !buildMappedCsvStories().length} onClick={importCsv}>Import {buildMappedCsvStories().length || ''} stories</button></div>
          </div>}

          {modal === 'export' && <div className="data-modal-body">
            <p className="data-help">Export the stories and voting information from this session as a CSV file.</p>
            <label className="data-check"><input type="checkbox" checked={includeHeader} onChange={(event) => setIncludeHeader(event.target.checked)} /> Include column headings</label>
            <label className="data-check"><input type="checkbox" checked={detailedVotes} onChange={(event) => setDetailedVotes(event.target.checked)} /> Include individual votes</label>
            <label className="data-check"><input type="checkbox" checked={onlyRevealed} onChange={(event) => setOnlyRevealed(event.target.checked)} /> Export only stories with revealed votes</label>
            <p className="data-count">{tickets.filter((story) => !onlyRevealed || revealedStories[story.id]).length} stories will be exported.</p>
            <div className="data-modal-actions"><button type="button" className="data-secondary" onClick={closeModal}>Cancel</button><button type="button" className="data-primary" disabled={!tickets.length} onClick={exportStories}><Download size={15} /> Download CSV</button></div>
          </div>}

          {modal === 'jira' && <div className="data-modal-body">
            <p className="data-help">Connect to your Atlassian JIRA project, search with JQL, then select the issues to add as stories. Your API token is used for this connection only and is not saved in browser storage.</p>
            <div className="jira-form-grid">
              <label>JIRA URL<input value={credentials.url} onChange={(event) => updateCredential('url', event.target.value)} placeholder="https://your-company.atlassian.net" /></label>
              <label>Project key<input value={credentials.project} onChange={(event) => updateCredential('project', event.target.value.toUpperCase())} placeholder="e.g. PROJ" /></label>
              <label>Atlassian email<input type="email" value={credentials.email} onChange={(event) => updateCredential('email', event.target.value)} placeholder="name@company.com" /></label>
              <label>API token<input type="password" autoComplete="off" value={credentials.token} onChange={(event) => updateCredential('token', event.target.value)} placeholder="Paste API token" /></label>
            </div>
            <div className="data-modal-actions jira-connect-actions"><button type="button" className="data-secondary" onClick={connectJira} disabled={jiraBusy}>Test connection</button></div>
            <form className="jira-search-form" onSubmit={runJiraSearch}><label>JQL query<input value={jql} onChange={(event) => setJql(event.target.value)} placeholder={`project = ${credentials.project || 'PROJECT'} ORDER BY created DESC`} /></label><button type="submit" className="data-primary" disabled={jiraBusy}><Search size={15} /> Search issues</button></form>
            {jiraStatus && <p className="data-help" role="status">{jiraStatus}</p>}
            {jiraIssues.length > 0 && <>
              <div className="jira-filter-row">
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Filter by key or summary" aria-label="Filter JIRA issues" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{statusOptions.map((value) => <option key={value}>{value}</option>)}</select>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All issue types</option>{typeOptions.map((value) => <option key={value}>{value}</option>)}</select>
              </div>
              <div className="jira-select-row"><label className="data-check"><input type="checkbox" checked={visibleIssues.length > 0 && visibleIssues.every((issue) => selectedKeys.includes(issue.key))} onChange={(event) => setSelectedKeys((old) => event.target.checked ? [...new Set([...old, ...visibleIssues.map((issue) => issue.key)])] : old.filter((key) => !visibleIssues.some((issue) => issue.key === key)))} /> Select visible</label><span>{selectedKeys.length} selected</span></div>
              <div className="data-preview-table jira-preview"><table><thead><tr><th></th><th>Key</th><th>Status</th><th>Summary</th></tr></thead><tbody>{visibleIssues.map((issue) => <tr key={issue.key}><td><input type="checkbox" checked={selectedKeys.includes(issue.key)} onChange={(event) => setSelectedKeys((old) => event.target.checked ? [...old, issue.key] : old.filter((key) => key !== issue.key))} aria-label={`Select ${issue.key}`} /></td><td><a href={issue.url} target="_blank" rel="noreferrer">{issue.key}</a></td><td>{issue.status}</td><td>{issue.summary}</td></tr>)}</tbody></table>{visibleIssues.length === 0 && <p className="data-help">No issues match these filters.</p>}</div>
            </>}
            <div className="data-modal-actions"><button type="button" className="data-secondary" onClick={closeModal}>Cancel</button><button type="button" className="data-primary" disabled={!selectedKeys.length} onClick={importJiraSelection}>Import {selectedKeys.length || ''} selected</button></div>
          </div>}
        </section>
      </div>}
    </>
  );
}
