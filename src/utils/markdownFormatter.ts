/**
 * Markdown Formatter Utility (Obsidian-compatible shortcuts)
 * Supports bold, italic, strikethrough, inline code, code blocks, links,
 * headings, bullet lists, numbered lists, blockquotes, and task checkboxes.
 */

export type MarkdownFormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'heading'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'bullet'
  | 'number'
  | 'quote'
  | 'task';

export function applyMarkdownFormat(
  editor: any,
  format: MarkdownFormatType,
  clipboardText?: string
): void {
  if (!editor) return;

  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return;

  const isCollapsed = selection.isEmpty();
  const selectedText = model.getValueInRange(selection);

  // Helper for inline wrapping/unwrapping
  const toggleInlineWrap = (wrapper: string) => {
    const wrapLen = wrapper.length;

    if (!isCollapsed) {
      // 1. Check if selection itself starts and ends with wrapper
      if (
        selectedText.startsWith(wrapper) &&
        selectedText.endsWith(wrapper) &&
        selectedText.length >= wrapLen * 2
      ) {
        const unwrapped = selectedText.slice(wrapLen, -wrapLen);
        editor.executeEdits('md-format', [
          {
            range: selection,
            text: unwrapped,
            forceMoveMarkers: true,
          },
        ]);
        return;
      }

      // 2. Check if surrounding characters outside selection match wrapper
      const startCol = selection.startColumn;
      const endCol = selection.endColumn;
      const lineNum = selection.startLineNumber;

      if (selection.startLineNumber === selection.endLineNumber && startCol > wrapLen) {
        const beforeText = model.getValueInRange({
          startLineNumber: lineNum,
          startColumn: startCol - wrapLen,
          endLineNumber: lineNum,
          endColumn: startCol,
        });
        const afterText = model.getValueInRange({
          startLineNumber: lineNum,
          startColumn: endCol,
          endLineNumber: lineNum,
          endColumn: endCol + wrapLen,
        });

        if (beforeText === wrapper && afterText === wrapper) {
          // Unwrap surrounding characters
          editor.executeEdits('md-format', [
            {
              range: {
                startLineNumber: lineNum,
                startColumn: startCol - wrapLen,
                endLineNumber: lineNum,
                endColumn: endCol + wrapLen,
              },
              text: selectedText,
              forceMoveMarkers: true,
            },
          ]);
          return;
        }
      }

      // 3. Otherwise wrap selection
      const wrapped = `${wrapper}${selectedText}${wrapper}`;
      editor.executeEdits('md-format', [
        {
          range: selection,
          text: wrapped,
          forceMoveMarkers: true,
        },
      ]);
      // Keep inside selected
      editor.setSelection({
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn + wrapLen,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn + wrapLen,
      });
    } else {
      // No selection: check if surrounding text has wrapper
      const lineNum = selection.startLineNumber;
      const col = selection.startColumn;
      const beforeText = model.getValueInRange({
        startLineNumber: lineNum,
        startColumn: Math.max(1, col - wrapLen),
        endLineNumber: lineNum,
        endColumn: col,
      });
      const afterText = model.getValueInRange({
        startLineNumber: lineNum,
        startColumn: col,
        endLineNumber: lineNum,
        endColumn: col + wrapLen,
      });

      if (beforeText === wrapper && afterText === wrapper) {
        // Remove empty wrapper
        editor.executeEdits('md-format', [
          {
            range: {
              startLineNumber: lineNum,
              startColumn: col - wrapLen,
              endLineNumber: lineNum,
              endColumn: col + wrapLen,
            },
            text: '',
            forceMoveMarkers: true,
          },
        ]);
      } else {
        // Insert empty wrapper and place cursor inside
        const emptyWrap = `${wrapper}${wrapper}`;
        editor.executeEdits('md-format', [
          {
            range: selection,
            text: emptyWrap,
            forceMoveMarkers: true,
          },
        ]);
        editor.setPosition({
          lineNumber: lineNum,
          column: col + wrapLen,
        });
      }
    }
  };

  switch (format) {
    case 'bold':
      toggleInlineWrap('**');
      break;

    case 'italic':
      toggleInlineWrap('*');
      break;

    case 'strikethrough':
      toggleInlineWrap('~~');
      break;

    case 'code':
      toggleInlineWrap('`');
      break;

    case 'codeblock': {
      if (!isCollapsed) {
        const wrapped = `\`\`\`\n${selectedText}\n\`\`\``;
        editor.executeEdits('md-format', [
          {
            range: selection,
            text: wrapped,
            forceMoveMarkers: true,
          },
        ]);
      } else {
        const line = selection.startLineNumber;
        const snippet = `\`\`\`\n\n\`\`\``;
        editor.executeEdits('md-format', [
          {
            range: selection,
            text: snippet,
            forceMoveMarkers: true,
          },
        ]);
        editor.setPosition({ lineNumber: line + 1, column: 1 });
      }
      break;
    }

    case 'link': {
      const isUrl = (s?: string) =>
        Boolean(s && (s.trim().startsWith('http://') || s.trim().startsWith('https://')));

      const urlCandidate = isUrl(clipboardText) ? clipboardText!.trim() : 'https://';

      if (!isCollapsed) {
        const textToUse = selectedText;
        const replacement = `[${textToUse}](${urlCandidate})`;
        editor.executeEdits('md-format', [
          {
            range: selection,
            text: replacement,
            forceMoveMarkers: true,
          },
        ]);
        if (!isUrl(clipboardText)) {
          // Select "https://" so user can replace immediately
          const urlStartCol = selection.startColumn + textToUse.length + 3;
          editor.setSelection({
            startLineNumber: selection.startLineNumber,
            startColumn: urlStartCol,
            endLineNumber: selection.startLineNumber,
            endColumn: urlStartCol + urlCandidate.length,
          });
        }
      } else {
        const replacement = `[제목](${urlCandidate})`;
        editor.executeEdits('md-format', [
          {
            range: selection,
            text: replacement,
            forceMoveMarkers: true,
          },
        ]);
        // Select "제목" so user can type title
        editor.setSelection({
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn + 1,
          endLineNumber: selection.startLineNumber,
          endColumn: selection.startColumn + 3,
        });
      }
      break;
    }

    case 'heading':
    case 'heading-1':
    case 'heading-2':
    case 'heading-3':
    case 'heading-4':
    case 'heading-5':
    case 'heading-6': {
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      const edits = [];

      for (let line = startLine; line <= endLine; line++) {
        const lineContent = model.getLineContent(line);
        const match = lineContent.match(/^(#{1,6})\s(.*)$/);
        let newLineContent = '';

        if (format === 'heading') {
          // Cycle headings: none -> # -> ## -> ### -> none
          if (!match) {
            newLineContent = `# ${lineContent}`;
          } else {
            const hashes = match[1];
            const rest = match[2];
            if (hashes.length < 3) {
              newLineContent = `${'#'.repeat(hashes.length + 1)} ${rest}`;
            } else {
              newLineContent = rest; // Reset to plain text
            }
          }
        } else {
          // Explicit heading level 1-6
          const level = parseInt(format.replace('heading-', ''), 10);
          const rest = match ? match[2] : lineContent;
          newLineContent = `${'#'.repeat(level)} ${rest}`;
        }

        edits.push({
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          },
          text: newLineContent,
          forceMoveMarkers: true,
        });
      }

      editor.executeEdits('md-format', edits);
      break;
    }

    case 'bullet': {
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      const edits = [];

      for (let line = startLine; line <= endLine; line++) {
        const lineContent = model.getLineContent(line);
        let newLineContent = '';

        if (/^(\s*)[-*+]\s(.*)$/.test(lineContent)) {
          // Remove bullet
          newLineContent = lineContent.replace(/^(\s*)[-*+]\s/, '$1');
        } else {
          // Add bullet
          const indentMatch = lineContent.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          newLineContent = `${indent}- ${lineContent.slice(indent.length)}`;
        }

        edits.push({
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          },
          text: newLineContent,
          forceMoveMarkers: true,
        });
      }

      editor.executeEdits('md-format', edits);
      break;
    }

    case 'number': {
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      const edits = [];

      for (let line = startLine; line <= endLine; line++) {
        const lineContent = model.getLineContent(line);
        let newLineContent = '';

        if (/^(\s*)\d+\.\s(.*)$/.test(lineContent)) {
          // Remove numbering
          newLineContent = lineContent.replace(/^(\s*)\d+\.\s/, '$1');
        } else {
          // Add numbering
          const idx = line - startLine + 1;
          const indentMatch = lineContent.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          newLineContent = `${indent}${idx}. ${lineContent.slice(indent.length)}`;
        }

        edits.push({
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          },
          text: newLineContent,
          forceMoveMarkers: true,
        });
      }

      editor.executeEdits('md-format', edits);
      break;
    }

    case 'quote': {
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      const edits = [];

      for (let line = startLine; line <= endLine; line++) {
        const lineContent = model.getLineContent(line);
        let newLineContent = '';

        if (/^(\s*)>\s?(.*)$/.test(lineContent)) {
          newLineContent = lineContent.replace(/^(\s*)>\s?/, '$1');
        } else {
          newLineContent = `> ${lineContent}`;
        }

        edits.push({
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          },
          text: newLineContent,
          forceMoveMarkers: true,
        });
      }

      editor.executeEdits('md-format', edits);
      break;
    }

    case 'task': {
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      const edits = [];

      for (let line = startLine; line <= endLine; line++) {
        const lineContent = model.getLineContent(line);
        let newLineContent = '';

        if (/^(\s*[-*+]\s)\[ \]\s(.*)$/.test(lineContent)) {
          // [ ] -> [x]
          newLineContent = lineContent.replace(/\[ \]/, '[x]');
        } else if (/^(\s*[-*+]\s)\[x\]\s(.*)$/i.test(lineContent)) {
          // [x] -> remove checkbox
          newLineContent = lineContent.replace(/\[[xX]\]\s/, '');
        } else if (/^(\s*[-*+]\s)(.*)$/.test(lineContent)) {
          // - -> - [ ]
          newLineContent = lineContent.replace(/^(\s*[-*+]\s)/, '$1[ ] ');
        } else {
          // plain -> - [ ] plain
          const indentMatch = lineContent.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          newLineContent = `${indent}- [ ] ${lineContent.slice(indent.length)}`;
        }

        edits.push({
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          },
          text: newLineContent,
          forceMoveMarkers: true,
        });
      }

      editor.executeEdits('md-format', edits);
      break;
    }

    default:
      break;
  }
}
