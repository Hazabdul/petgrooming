function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: Record<string, unknown>[], headers?: { key: string; label: string }[]): string {
  if (rows.length === 0 && !headers) return '';
  const cols = headers ?? Object.keys(rows[0] ?? {}).map((k) => ({ key: k, label: k }));
  const headerLine = cols.map((c) => escapeCsv(c.label)).join(',');
  const dataLines = rows.map((row) => cols.map((c) => escapeCsv(row[c.key])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv(filename: string, rows: Record<string, unknown>[], headers?: { key: string; label: string }[]) {
  downloadFile(filename, toCsv(rows, headers), 'text/csv;charset=utf-8;');
}

function xmlEscape(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportExcel(filename: string, rows: Record<string, unknown>[], headers?: { key: string; label: string }[]) {
  const cols = headers ?? (rows.length > 0 ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  const headerCells = cols.map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c.label)}</Data></Cell>`).join('');
  const dataRows = rows
    .map((row) => {
      const cells = cols
        .map((c) => {
          const v = row[c.key];
          const isNum = typeof v === 'number' && Number.isFinite(v);
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(v ?? '')}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row>${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
  downloadFile(filename, xml, 'application/vnd.ms-excel');
}

export function exportPdf(title: string, rows: Record<string, unknown>[], headers?: { key: string; label: string }[]) {
  const cols = headers ?? (rows.length > 0 ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to export PDF');
    return;
  }
  const tableHtml = rows.length === 0
    ? '<p style="padding:16px;color:#666">No data to display</p>'
    : `<table><thead><tr>${cols.map((c) => `<th>${xmlEscape(c.label)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((row) => `<tr>${cols.map((c) => `<td>${xmlEscape(row[c.key] ?? '')}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
  win.document.write(`<!DOCTYPE html><html><head><title>${xmlEscape(title)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
  </style></head><body>
  <h1>${xmlEscape(title)}</h1>
  <div class="meta">Miss Meow Mobile Pet Grooming &middot; Generated ${new Date().toLocaleString()}</div>
  ${tableHtml}
  <script>window.onload = function() { window.print(); }<\/script>
  </body></html>`);
  win.document.close();
}

export function exportData(
  format: 'excel' | 'csv' | 'pdf',
  baseName: string,
  title: string,
  rows: Record<string, unknown>[],
  headers?: { key: string; label: string }[]
) {
  if (format === 'excel') exportExcel(`${baseName}.xls`, rows, headers);
  else if (format === 'csv') exportCsv(`${baseName}.csv`, rows, headers);
  else exportPdf(title, rows, headers);
}
