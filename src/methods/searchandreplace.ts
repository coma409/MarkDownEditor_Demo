// searchandreplace.ts
export interface Match {
  index: number;
  length: number;
}

export interface ScrollToMatchOptions {
  textarea: HTMLTextAreaElement;
  matches: Match[];
  currentMatchIndex: number;
  direction: string;
}

let setMatchIndex = 0;

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findAllMatches(text: string, searchTerm: string, isRegex: boolean): Match[] {
  const searchText = isRegex ? searchTerm : escapeRegExp(searchTerm);
  const regex = new RegExp(searchText, 'gi');
  const matches: Match[] = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length });
  }

  return matches;
}

export function scrollToMatch(options: ScrollToMatchOptions): number {
  const { textarea, matches, currentMatchIndex, direction } = options;

  let newCurrentMatchIndex = currentMatchIndex;

  if (direction === 'forward') {
    let startIndex = textarea.selectionEnd;
    newCurrentMatchIndex = matches.findIndex(match => match.index >= startIndex);
    if (newCurrentMatchIndex === -1) {
      newCurrentMatchIndex = 0;
    }
  } else if (direction === 'backward') {
    let endIndex = textarea.selectionStart;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].index + matches[i].length < endIndex) {
        newCurrentMatchIndex = i;
        break;
      }
    }
    if (newCurrentMatchIndex === -1) {
      newCurrentMatchIndex = matches.length - 1;
    }
  }

  const currentMatch = matches[newCurrentMatchIndex];

  textarea.focus();
  textarea.setSelectionRange(currentMatch.index, currentMatch.index + currentMatch.length);

  scrollToPosition(textarea, currentMatch.index);

  return newCurrentMatchIndex;
}

export function scrollToPosition(textarea: HTMLTextAreaElement, positionIndex: number) {
  const textMeasureDiv = document.createElement('div');

  textMeasureDiv.style.width = textarea.clientWidth + 'px';
  textMeasureDiv.style.font = getComputedStyle(textarea).font;
  textMeasureDiv.style.lineHeight = getComputedStyle(textarea).lineHeight;
  textMeasureDiv.style.visibility = 'hidden';
  textMeasureDiv.style.position = 'absolute';
  textMeasureDiv.style.whiteSpace = 'pre-wrap';
  textMeasureDiv.style.overflowWrap = 'break-word';
  document.body.appendChild(textMeasureDiv);

  const textBeforeMatch = textarea.value.substring(0, positionIndex);
  textMeasureDiv.textContent = textBeforeMatch;

  const textHeight = textMeasureDiv.getBoundingClientRect().height;

  document.body.removeChild(textMeasureDiv);

  const halfViewportHeight = textarea.clientHeight / 2;
  let newScrollTop = textHeight - halfViewportHeight;

  newScrollTop = Math.max(newScrollTop, 0);
  newScrollTop = Math.min(newScrollTop, textarea.scrollHeight - textarea.clientHeight);

  textarea.scrollTop = newScrollTop;
}

export function findInTextarea(text: string, direction: string, useRegex: boolean, vm: any) {
  const textarea = vm.$refs.inputBox;
  if (!textarea) return;

  const matches = findAllMatches(textarea.value, text, useRegex);

  if (matches.length === 0) {
    return {
      currentMatchIndex: 0,
      totalMatches: 0,
    };
  }

  let currentMatchIndex = scrollToMatch({
    textarea: vm.$refs.inputBox,
    matches: matches,
    currentMatchIndex: -1,
    direction: direction,
  });

  return {
    currentMatchIndex: currentMatchIndex + 1,
    totalMatches: matches.length,
  };
}

export function replaceEditorText(
  markdown: string,
  findText: string,
  replaceText: string,
  useRegex: boolean,
  replaceAll: boolean,
  direction: string,
  vm: any,
  currentMatchIndex: number = 0
): { newMarkdown: string; currentMatchIndex: number; totalMatches: number } {
  const matches = findAllMatches(markdown, findText, useRegex);
  let newMarkdown = markdown;

  if (matches.length === 0) {
    return {
      newMarkdown: markdown,
      currentMatchIndex: 0,
      totalMatches: 0,
    };
  }

  if (direction !== 'now') {
    setMatchIndex = scrollToMatch({
      textarea: vm.$refs.inputBox,
      matches: matches,
      currentMatchIndex: -1, // 初始化为 -1
      direction: direction,
    });
  }

  if (replaceAll && direction === 'now') {
    newMarkdown = replaceMatches(markdown, matches, replaceText);
  } else if (!replaceAll && direction === 'now') {
    // Replace only the currently highlighted match
    const match = matches[setMatchIndex];
    newMarkdown =
      markdown.substring(0, match.index) +
      replaceText +
      markdown.substring(match.index + match.length);
  }

  const totalMatches = matches.length;

  // Ensure the currentMatchIndex is within the bounds of the matches array
  currentMatchIndex = Math.max(0, Math.min(setMatchIndex, totalMatches - 1));

  return {
    newMarkdown,
    currentMatchIndex: currentMatchIndex + 1, // Convert to 1-based index
    totalMatches,
  };
}

export function replaceMatches(text: string, matches: Match[], replaceTerm: string): string {
  let offset = 0;
  let result = '';

  for (const match of matches) {
    result += text.substring(offset, match.index) + replaceTerm;
    offset = match.index + match.length;
  }
  result += text.substring(offset);

  return result;
}