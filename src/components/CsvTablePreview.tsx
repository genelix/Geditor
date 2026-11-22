import React, { useMemo, useState } from 'react';

interface CsvTablePreviewProps {
  content: string;
}

export const CsvTablePreview: React.FC<CsvTablePreviewProps> = ({ content }) => {
  const [filterText, setFilterText] = useState('');

  const { headers, rows } = useMemo(() => {
    if (!content) return { headers: [], rows: [] };
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    // Simple CSV parser supporting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headerRow = parseLine(lines[0]);
    const bodyRows = lines.slice(1).map(parseLine);
    return { headers: headerRow, rows: bodyRows };
  }, [content]);

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(lower))
    );
  }, [rows, filterText]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#18181b',
        color: '#e4e4e7',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#1f1f23',
        }}
      >
        <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
          Total rows: {rows.length} | Columns: {headers.length}
        </span>
        <input
          type="text"
          placeholder="Filter rows..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '4px 8px',
            fontSize: '12px',
            outline: 'none',
            marginLeft: 'auto',
            width: '180px',
          }}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            fontFamily: 'Menlo, Monaco, monospace',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  border: '1px solid #3f3f46',
                  padding: '6px 10px',
                  backgroundColor: '#27272a',
                  color: '#38bdf8',
                  width: '40px',
                  textAlign: 'center',
                }}
              >
                #
              </th>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    border: '1px solid #3f3f46',
                    padding: '6px 10px',
                    backgroundColor: '#27272a',
                    color: '#f4f4f5',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  backgroundColor: rIdx % 2 === 0 ? '#18181b' : '#1e1e24',
                }}
              >
                <td
                  style={{
                    border: '1px solid #27272a',
                    padding: '4px 8px',
                    color: '#71717a',
                    textAlign: 'center',
                  }}
                >
                  {rIdx + 1}
                </td>
                {headers.map((_, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      border: '1px solid #27272a',
                      padding: '4px 8px',
                      color: '#d4d4d8',
                    }}
                  >
                    {row[cIdx] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
