import { useEffect, useMemo, useState } from 'react';
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

export default function DataImportExport({ canManage, tickets, votesPerStory, revealedStories, onImportStories, onNotice, showToolbar = true }) {
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
  const [exportFields, setExportFields] = useState({ id: true, title: true, description: true, points: true, voteCount: true, average: true, votes: false });
  const [credentials, setCredentials] = useState(savedJiraDetails);
  const [jql, setJql] = useState('');
  const [jiraIssues, setJiraIssues] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [jiraStatus, setJiraStatus] = useState('');
  const [jiraBusy, setJiraBusy] = useState(false);

  useEffect(() => {
    const handleMenuAction = (event) => {
      const action = event.detail;
      if (!['csv','jira','export'].includes(action)) return;
      setModal(action);
      setCsvError('');
      setJiraStatus('');
    };
    window.addEventListener('simply-poker:data-action', handleMenuAction);
    return () => window.removeEventListener('simply-poker:data-action', handleMenuAction);
  }, []);

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
    const fields = [
      ['id','ID', story => story.idDisplay || story.id],
      ['title','Title', story => story.text || story.title || ''],
      ['description','Description', story => story.descriptionDisplay || ''],
      ['points','Story Points', story => story.points || '?'],
      ['voteCount','Vote Count', story => Object.keys(votesPerStory[story.id] || {}).length],
      ['average','Average Vote', story => {
        const values = Object.values(votesPerStory[story.id] || {}).map(value => value === '½' ? 0.5 : Number(value)).filter(Number.isFinite);
        return values.length ? (values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2) : '';
      }],
      ['votes','Votes', story => Object.values(votesPerStory[story.id] || {}).map(String).join('; ')],
    ].filter(([key]) => exportFields[key]);
    if (!fields.length) { onNotice?.('Select at least one field to export.'); return; }
    const rows = [fields.map(([,label])=>label)];
    stories.forEach(story => rows.push(fields.map(([, , get])=>get(story))));
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
      {showToolbar && <div className="data-tools">
        <button type="button" onClick={() => { setModal('csv'); setCsvError(''); }}><Upload size={15} /> Import CSV</button>
        <button type="button" onClick={() => setModal('export')}><Download size={15} /> Export CSV</button>
        <button type="button" onClick={() => { setModal('jira'); setJiraStatus(''); }}><Link2 size={15} /> Import from JIRA</button>
      </div>}

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
            <label className="file-picker" onDragOver={event=>{event.preventDefault();event.currentTarget.classList.add('drag-over');}} onDragLeave={event=>event.currentTarget.classList.remove('drag-over')} onDrop={event=>{event.preventDefault();event.currentTarget.classList.remove('drag-over');const file=event.dataTransfer.files?.[0];if(file)readCsv(file);}}><FileSpreadsheet size={19} /><span>{csvFile?.name || 'Drop a CSV here or choose a file'}</span><input type="file" accept=".csv,text/csv,.txt" onChange={(event) => event.target.files?.[0] && readCsv(event.target.files[0])} /></label>
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
            <div className="csv-export-mapping"><h3>Field mapping</h3><p className="data-help">Choose which story and voting fields to include in the exported file.</p>{[['id','Story ID'],['title','Title'],['description','Description'],['points','Story Points'],['voteCount','Vote Count'],['average','Average Vote'],['votes','Individual Votes']].map(([key,label])=><label className="data-check" key={key}><input type="checkbox" checked={exportFields[key]} onChange={e=>setExportFields(old=>({...old,[key]:e.target.checked}))}/>{label}</label>)}</div>
            <label className="data-check"><input type="checkbox" checked={onlyRevealed} onChange={(event) => setOnlyRevealed(event.target.checked)} /> Export only stories with revealed votes</label>
            <p className="data-count">{tickets.filter((story) => !onlyRevealed || revealedStories[story.id]).length} stories will be exported · {Object.values(exportFields).filter(Boolean).length} fields selected.</p>
            <div className="data-preview-table"><table><thead><tr>{[['id','ID'],['title','Title'],['description','Description'],['points','Points'],['voteCount','Votes'],['average','Average'],['votes','Individual votes']].filter(([key])=>exportFields[key]).map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{tickets.filter(story=>!onlyRevealed||revealedStories[story.id]).slice(0,5).map(story=><tr key={story.id}>{[['id',story.idDisplay||story.id],['title',story.text||story.title||''],['description',story.descriptionDisplay||''],['points',story.points||'?'],['voteCount',Object.keys(votesPerStory[story.id]||{}).length],['average',(()=>{const v=Object.values(votesPerStory[story.id]||{}).map(x=>x==='½'?0.5:Number(x)).filter(Number.isFinite);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):''})()],['votes',Object.values(votesPerStory[story.id]||{}).join('; ')]].filter(([key])=>exportFields[key]).map(([key,value])=><td key={key}>{value}</td>)}</tr>)}</tbody></table></div>
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
