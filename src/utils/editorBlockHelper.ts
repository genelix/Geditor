/**
 * Editor Block Helper
 * Utilities for analyzing document block boundaries (tables, lists, paragraphs, code blocks, headings)
 * and calculating precise insertion positions for Inline AI results without overwriting selected text.
 */

export interface BlockInsertionResult {
  insertLineNumber: number;
  insertColumn: number;
  textToInsert: string;
}

/**
 * Calculates the exact insertion position and formatted text below the block
 * containing the user selection or cursor position.
 *
 * Rules:
 * - Keeps the original selected text intact (no deletion/replacement).
 * - Finds the line where the enclosing block ends:
 *   - Table: last line of the continuous markdown table
 *   - Fenced Code: closing fence line (``` or ~~~)
 *   - List / Ordered list: line where the current level of list items ends
 *   - Blockquote: line where the continuous blockquote ends
 *   - Heading: heading line (or setext underline line)
 *   - General paragraph: line where the paragraph ends (before empty line or next block element)
 * - Inserts the cleaned output on the line below the block, cleanly padded with blank lines.
 */
export function calculateBlockEndInsertion(
  getLineContent: (lineNumber: number) => string,
  getLineMaxColumn: (lineNumber: number) => number,
  totalLines: number,
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  },
  cleanedOutput: string
): BlockInsertionResult {
  let startLine = range.startLineNumber;
  let endLine = range.endLineNumber;

  // If selection ends at column 1 of a subsequent line, don't include that line
  if (range.endColumn === 1 && endLine > startLine) {
    endLine = endLine - 1;
  }

  // Bound to document line range
  startLine = Math.max(1, Math.min(totalLines, startLine));
  endLine = Math.max(1, Math.min(totalLines, endLine));

  const endLineContent = getLineContent(endLine);
  const trimmedEnd = endLineContent.trim();

  // If the target line is already completely blank (e.g. cursor on empty line)
  if (trimmedEnd === '' && startLine === endLine) {
    const maxCol = getLineMaxColumn(endLine);
    return {
      insertLineNumber: endLine,
      insertColumn: maxCol,
      textToInsert: cleanedOutput,
    };
  }

  let blockEndLine = endLine;

  // 1. Fenced Code Block: check if inside code block
  let inCodeBlock = false;
  const fencePattern = /^\s*(```|~~~)/;
  for (let i = 1; i <= endLine; i++) {
    if (fencePattern.test(getLineContent(i))) {
      inCodeBlock = !inCodeBlock;
    }
  }
  if (inCodeBlock) {
    for (let i = endLine + 1; i <= totalLines; i++) {
      if (fencePattern.test(getLineContent(i))) {
        blockEndLine = i;
        break;
      }
      blockEndLine = totalLines;
    }
  }
  // 2. Table Block
  else if (trimmedEnd.includes('|')) {
    let cur = endLine;
    while (cur < totalLines) {
      const next = getLineContent(cur + 1).trim();
      if (next === '' || !next.includes('|')) break;
      cur++;
    }
    blockEndLine = cur;
  }
  // 3. List Block (unordered, ordered, task list)
  else if (/^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/.test(endLineContent)) {
    const listMatch = endLineContent.match(/^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/);
    const baseIndent = listMatch ? listMatch[1].length : 0;
    const listRegex = /^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/;

    let cur = endLine;
    while (cur < totalLines) {
      const nextRaw = getLineContent(cur + 1);
      const nextTrim = nextRaw.trim();
      if (nextTrim === '') break;

      const nextListMatch = nextRaw.match(listRegex);
      if (nextListMatch) {
        const nextIndent = nextListMatch[1].length;
        if (nextIndent >= baseIndent) {
          cur++;
        } else {
          // Less indented list item -> current level ended
          break;
        }
      } else {
        // Indented continuation paragraph for current list item
        const indentMatch = nextRaw.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        if (indent > baseIndent) {
          cur++;
        } else {
          break;
        }
      }
    }
    blockEndLine = cur;
  }
  // 4. Blockquote Block
  else if (/^\s*>/.test(trimmedEnd)) {
    let cur = endLine;
    while (cur < totalLines) {
      const nextTrim = getLineContent(cur + 1).trim();
      if (!/^\s*>/.test(nextTrim)) break;
      cur++;
    }
    blockEndLine = cur;
  }
  // 5. Heading Block
  else if (/^#{1,6}\s+/.test(trimmedEnd)) {
    blockEndLine = endLine;
  }
  // Setext heading underline (=== or ---)
  else if (endLine < totalLines && /^(=+|-+)$/.test(getLineContent(endLine + 1).trim()) && trimmedEnd !== '') {
    blockEndLine = endLine + 1;
  }
  // 6. Thematic Break (---, ***, ___)
  else if (/^(?:[-*_]\s*){3,}$/.test(trimmedEnd)) {
    blockEndLine = endLine;
  }
  // 7. General Paragraph Block
  else {
    let cur = endLine;
    const listRegex = /^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/;
    while (cur < totalLines) {
      const nextRaw = getLineContent(cur + 1);
      const nextTrim = nextRaw.trim();
      if (nextTrim === '') break;

      // Stop if next line begins a new markdown block element
      if (
        /^#{1,6}\s+/.test(nextTrim) ||
        fencePattern.test(nextTrim) ||
        nextTrim.includes('|') ||
        listRegex.test(nextRaw) ||
        /^\s*>/.test(nextTrim) ||
        /^(?:[-*_]\s*){3,}$/.test(nextTrim)
      ) {
        break;
      }
      cur++;
    }
    blockEndLine = cur;
  }

  // Format insertion text:
  // Insert at end of blockEndLine
  const maxCol = getLineMaxColumn(blockEndLine);
  const lineAfter = blockEndLine < totalLines ? getLineContent(blockEndLine + 1).trim() : null;

  let textToInsert = '';
  if (lineAfter === null || lineAfter === '') {
    // EOF or next line is already empty
    textToInsert = '\n\n' + cleanedOutput;
  } else {
    // Next line has content, add trailing newline so there is a blank line below too
    textToInsert = '\n\n' + cleanedOutput + '\n';
  }

  return {
    insertLineNumber: blockEndLine,
    insertColumn: maxCol,
    textToInsert,
  };
}
