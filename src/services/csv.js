const detectDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let quoted = false;
  let commas = 0;
  let tabs = 0;
  for (let i = 0; i < firstLine.length; i += 1) {
    const char = firstLine[i];
    if (char === '"' && firstLine[i + 1] === '"' && quoted) { i += 1; continue; }
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') commas += 1;
    else if (!quoted && char === '\t') tabs += 1;
  }
  return tabs > commas ? '\t' : ',';
};

export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const delimiter = detectDelimiter(text.replace(/^\uFEFF/, ''));
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

const normaliseHeader = (value) => String(value || '').toLowerCase().replace(/[\s_-]/g, '');

export function csvRowsToStories(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normaliseHeader);
  const idIndex = headers.findIndex((h) => ['id', 'key', 'issuekey', 'ticketid'].includes(h));
  const titleIndex = headers.findIndex((h) => ['summary', 'title', 'name', 'story'].includes(h));
  const descriptionIndex = headers.findIndex((h) => ['description', 'details'].includes(h));
  const hasHeaders = idIndex >= 0 || titleIndex >= 0 || descriptionIndex >= 0;
  const dataRows = hasHeaders ? rows.slice(1) : rows;
  const firstId = hasHeaders && idIndex >= 0 ? idIndex : 0;
  const firstTitle = hasHeaders && titleIndex >= 0 ? titleIndex : (hasHeaders && descriptionIndex >= 0 ? descriptionIndex : 1);
  const firstDescription = hasHeaders ? descriptionIndex : 2;

  return dataRows.map((cells, index) => {
    const idValue = String(cells[firstId] || '').trim();
    const title = String(cells[firstTitle] || '').trim();
    const description = firstDescription >= 0 ? String(cells[firstDescription] || '').trim() : '';
    const text = title || description || cells.filter(Boolean).join(' ').trim();
    if (!text) return null;
    const id = idValue || `csv_${Date.now()}_${index}`;
    return {
      id: `story_csv_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${index}`,
      text,
      idDisplay: idValue,
      descriptionDisplay: description && description !== text ? description : '',
      originalText: text,
      originalLang: 'en',
      points: '?',
    };
  }).filter(Boolean);
}

export function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  return /[",\\r\\n\\t]/.test(text) || text.trim() !== text
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function buildCsv(rows, includeHeader = true) {
  const dataRows = includeHeader ? rows : rows.slice(1);
  return dataRows.map((row) => row.map(escapeCsv).join(',')).join('\\r\\n');
}
