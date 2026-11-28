/**
 * AI Code Parser & Indentation Formatter
 * Formats, extracts, and aligns code copied from Gemini, ChatGPT, Claude, etc.
 */

export interface ParsedAiCode {
  code: string;
  language?: string;
  isExtracted: boolean;
  lineCount: number;
}

/**
 * Parses raw clipboard text from AI responses and extracts clean code.
 * Handles single or multiple markdown code fences (```lang ... ```).
 */
export function extractAiCode(rawText: string): ParsedAiCode {
  const text = rawText.trim();
  if (!text) {
    return { code: '', isExtracted: false, lineCount: 0 };
  }

  // Regex to match markdown code blocks ```lang\n...```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  const matches: { lang: string; content: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    matches.push({
      lang: match[1]?.trim() || '',
      content: match[2],
    });
  }

  if (matches.length > 0) {
    // If multiple blocks found, concatenate them with double line break
    const joinedCode = matches.map((m) => m.content).join('\n\n').replace(/\r\n/g, '\n');
    const firstLang = matches[0].lang || undefined;
    const lines = joinedCode.split('\n');
    return {
      code: joinedCode,
      language: firstLang,
      isExtracted: true,
      lineCount: lines.length,
    };
  }

  // If text starts with ``` and hasn't closed yet
  const unclosedMatch = text.match(/^```([a-zA-Z0-9_-]*)\r?\n([\s\S]*)$/);
  if (unclosedMatch) {
    const lines = unclosedMatch[2].replace(/\r\n/g, '\n').split('\n');
    return {
      code: unclosedMatch[2].replace(/\r\n/g, '\n'),
      language: unclosedMatch[1] || undefined,
      isExtracted: true,
      lineCount: lines.length,
    };
  }

  // If no code fence found, return normalized text
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  return {
    code: normalized,
    isExtracted: false,
    lineCount: lines.length,
  };
}

/**
 * Adjusts indentation of multi-line code so it seamlessly matches
 * the cursor's current indentation depth in the editor.
 */
export function adjustIndentation(code: string, currentLinePrefix: string): string {
  if (!code) return '';
  const lines = code.split('\n');
  if (lines.length <= 1) {
    return code;
  }

  // Determine current indentation depth (spaces or tabs)
  const indentMatch = currentLinePrefix.match(/^[\t ]*/);
  const targetIndent = indentMatch ? indentMatch[0] : '';

  // Determine common base indentation of the source code (excluding blank lines)
  const nonBlankLines = lines.filter((line) => line.trim().length > 0);
  let minBaseIndent = Infinity;

  for (const line of nonBlankLines) {
    const match = line.match(/^[\t ]*/);
    const len = match ? match[0].length : 0;
    if (len < minBaseIndent) {
      minBaseIndent = len;
    }
  }

  if (minBaseIndent === Infinity) {
    minBaseIndent = 0;
  }

  // Strip minimum common indent and prepend targetIndent to lines (from line index 1 onwards,
  // because line 0 is inserted right at cursor position)
  const adjusted = lines.map((line, index) => {
    if (line.trim().length === 0) return '';
    const stripped = line.length >= minBaseIndent ? line.slice(minBaseIndent) : line.trimStart();
    if (index === 0) {
      return stripped;
    }
    return targetIndent + stripped;
  });

  return adjusted.join('\n');
}

/**
 * Prepares an optimized prompt containing the selected code snippet
 * ready to paste into Gemini / ChatGPT / Claude.
 */
export function generateAiPrompt(
  selectedCode: string,
  language = 'text',
  intent: 'explain' | 'fix' | 'refactor' | 'optimize' | 'general' = 'general'
): string {
  const codeBlock = `\`\`\`${language}\n${selectedCode.trim()}\n\`\`\``;

  switch (intent) {
    case 'fix':
      return `다음 ${language} 코드의 문제점이나 버그를 찾고 해결 방안과 수정된 코드를 제시해 주세요:\n\n${codeBlock}`;
    case 'optimize':
      return `다음 ${language} 코드의 실행 성능 및 가독성 최적화를 위한 개선안과 수정 코드를 제시해 주세요:\n\n${codeBlock}`;
    case 'refactor':
      return `다음 ${language} 코드를 모범 사례(Clean Code, SOLID)에 맞게 리팩토링해 주세요:\n\n${codeBlock}`;
    case 'explain':
      return `다음 ${language} 코드가 수행하는 핵심 로직과 동작 방식을 단계별로 명확하게 설명해 주세요:\n\n${codeBlock}`;
    case 'general':
    default:
      return `다음 ${language} 코드를 검토하고 개선 제안이나 질문에 답해 주세요:\n\n${codeBlock}\n\n질문/요청 사항: `;
  }
}

/**
 * Cleans and sanitizes raw AI response for inline editor insertion.
 * Unwraps outer code fences if the entire response was enclosed in one,
 * and removes common conversational preamble boilerplate.
 */
export function cleanInlineAiOutput(rawText: string, _isMarkdownDoc = true): string {
  let cleaned = rawText.trim();
  if (!cleaned) return '';

  // Remove common AI conversational opening phrases
  const preamblePatterns = [
    /^(?:네[,\.\s]|물론입니다[,\.\s]|요청하신[^\n]*입니다[:\.\s]*\n+)+/i,
    /^(?:다음은\s+[^\n]*결과입니다[:\.\s]*\n+)+/i,
    /^(?:아래는\s+[^\n]*내용입니다[:\.\s]*\n+)+/i,
    /^(?:Here is the [^\n]*:\n+)+/i,
    /^(?:Sure[,\.!]?[^\n]*:\n+)+/i,
  ];

  for (const pattern of preamblePatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // Remove common AI conversational trailing phrases
  const closingPatterns = [
    /\n+(?:더\s*필요하신\s*점이\s*있으시면[^\n]*\.*|\s*도움이\s*되셨길[^\n]*\.*|\s*추가\s*질문이\s*있으시면[^\n]*\.*)$/i,
    /\n+(?:Hope this helps[^\n]*|Let me know if you need anything else[^\n]*)$/i,
  ];

  for (const pattern of closingPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // If the entire output is wrapped inside a single outer markdown fence
  const outerFenceMatch = cleaned.match(/^```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```$/);
  if (outerFenceMatch) {
    cleaned = outerFenceMatch[1].trim();
  }

  return cleaned;
}
