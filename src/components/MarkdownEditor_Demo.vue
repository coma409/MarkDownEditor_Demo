<template>
  <div id="app">
    <textarea class="input" ref="inputBox" placeholder="在此输入 Markdown 文本" v-model="markdown"></textarea>
    <div class="output" ref="outputBox"></div>
  </div>
</template>
  
<script lang="ts">
import * as marked from 'marked';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash.min.js'
import 'prismjs/components/prism-c.min.js'
import 'prismjs/components/prism-cpp.min.js'
import 'prismjs/components/prism-csharp.min.js'
import 'prismjs/components/prism-css.min.js'
import 'prismjs/components/prism-go.min.js'
import 'prismjs/components/prism-java.min.js'
import 'prismjs/components/prism-javascript.min.js'
import 'prismjs/components/prism-json.min.js'
import 'prismjs/components/prism-json5.min.js'
import 'prismjs/components/prism-kotlin.min.js'
import 'prismjs/components/prism-latex.min.js'
import 'prismjs/components/prism-markup.min.js'
import 'prismjs/components/prism-powershell.min.js'
import 'prismjs/components/prism-python.min.js'
import 'prismjs/components/prism-rust.min.js'
import 'prismjs/components/prism-sql.min.js'
import 'prismjs/components/prism-typescript.min.js'
import 'prismjs/components/prism-yaml.min.js'
import 'prismjs/themes/prism-solarizedlight.css';
import 'katex/dist/katex.min.js';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import renderMathInElement from 'katex/dist/contrib/auto-render.js';
import { ref, watch, computed, onMounted, onBeforeUnmount, inject, getCurrentInstance } from 'vue'
import { Store } from 'vuex'
import { vuexState } from '../store'

mermaid.initialize({ startOnLoad: false });

declare global {
interface Window {
    electron: {
      ipcRenderer: Electron.IpcRenderer;
    };
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $store: Store<vuexState>;
  }
}

const ipcRenderer = window.electron.ipcRenderer

interface Match {
  index: number;
  length: number;
}

interface ScrollToMatchOptions {
  textarea: HTMLTextAreaElement;
  matches: Match[];
  currentMatchIndex: number;
  direction: string;
}

let setMatchIndex = 0;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAllMatches(text: string, searchTerm: string, isRegex: boolean): Match[] {
  const searchText = isRegex ? searchTerm : escapeRegExp(searchTerm);
  const regex = new RegExp(searchText, 'gi');
  const matches: Match[] = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length });
  }

  return matches;
}

function scrollToMatch(options: ScrollToMatchOptions): number {
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

function scrollToPosition(textarea: HTMLTextAreaElement, positionIndex: number) {
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

function findInTextarea(text: string, direction: string, useRegex: boolean, vm: any) {
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
    currentMatchIndex: -1, // 初始化为 -1
    direction: direction,
  });

  return {
    currentMatchIndex: currentMatchIndex + 1,
    totalMatches: matches.length,
  };
}

function replaceEditorText(
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

function replaceMatches(text: string, matches: Match[], replaceTerm: string): string {
  let offset = 0;
  let result = '';

  for (const match of matches) {
    result += text.substring(offset, match.index) + replaceTerm;
    offset = match.index + match.length;
  }
  result += text.substring(offset);

  return result;
}

function debounce<T extends any[]>(func: (...args: T) => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: T) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

async function markedRenderer(markdown: string) {
  const renderer = new marked.Renderer();

  renderer.table = function (header: string, body: string) {
    return `<table style="border: 1px solid #ccc; border-collapse: collapse;">
              <thead>
                ${header}
              </thead>
              <tbody>
                ${body}
              </tbody>
            </table>`;
  };
  
  renderer.tablecell = function (content: string, flags: any) {
    const tag = flags.header ? "th" : "td";
    let style = "";
    if (flags.header && flags.align) {
      style += `text-align: ${flags.align};`;
    }
    if (flags.header) {
      style += "padding: 6px 13px;";
      style += "border-bottom: 2px solid #ebebeb;";
      style += "background-color: #f7f7f7;";
    } else {
      style += "padding: 6px 13px;";
      style += "border-top: 1px solid #ebebeb;";
    }
    return `<${tag} style="${style}">
              ${content}
            </${tag}>`;
  };
  
  renderer.code = function (code: string, lang: string, escaped: boolean) {
    if (!lang) {
      return `<pre><code class="language-none">${code}</code></pre>`;
    }
    return marked.Renderer.prototype.code.call(this, code, lang, escaped);
  };
  
  renderer.codespan = function (code: string) {
    return `<code class="language-none">${code}</code>`;
  };
  
  renderer.link = function(href, title, text) {
    return `<a target="_blank" href="${href}" title="${title}">${text}</a>`;
  };
  
  renderer.image = function(href, title) {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return `<a target="_blank" href="${href}" title="${title}"><img src="${href}" alt="${title}"></a>`;
    } else {
      return `<img src="${href}" alt="${title}">`;
    }
  };
  
  const inlineKatex = {
    extensions: [{
      name: 'inlineKatex',
      level: 'inline',
      start(src: string) { return src.indexOf('$'); },
      tokenizer(src: string) {
        src = src.replace(/</g, "&lt;");
        src = src.replace(/>/g, "&gt;");
        let match;
        if (src.indexOf('&lt;') !== -1 || src.indexOf('&gt;') !== -1) {
          match = src.match(/^\$+(.*)(?=\$).*$/);
        } else {
          match = src.match(/^\$+([\s\S]*?)\$+/);
        }
        if (match) {
          const token =  {
            type: 'inlineKatex',
            raw: match[0],
            text: match[1].trim(),
            tokens: []
          };
          return token;
        }
      },
      renderer(token) {
        return token.raw;
      },
    }],
    async: true,
    async walkTokens(token) {
      if (token.type === 'inlineKatex') {
        const regex = /`([^`]+)`/g;
        token.raw = token.raw.replace(regex, '<code class="language-none">$1</code>');
      }
    }
  }
  
  const blockKatex = {
    extensions: [{
      name: 'blockKatex',
      level: 'block',
      start(src: string) { return src.indexOf('$$'); },
      tokenizer(src: string) {
        src = src.replace(/</g, "&lt;");
        src = src.replace(/>/g, "&gt;");
        let match;
        if (src.indexOf('&lt;') !== -1 || src.indexOf('&gt;') !== -1) {
          match = src.match(/^\$\$+(.*)(?=\$\$).*$/);
        } else {
          match = src.match(/^\$\$+([\s\S]*?)\$\$+/);
        }
        if (match) {
          const token =  {
            type: 'blockKatex',
            raw: match[0],
            text: match[1].trim(),
            tokens: []
          };
          return token;
        }
      },
      renderer(token) {
        return token.raw;
      }
    }],
    async: true,
    async walkTokens(token) {
      if (token.type === 'inlineKatex') {
        const regex = /`([^`]+)`/g;
        token.raw = token.raw.replace(regex, '<code class="language-none">$1</code>');
      }
    }
  }
  
  const plantUMLExtension = {
    extensions: [{
      name: 'plantUML',
      level: 'block',
      start(src: string) { return src.indexOf('```plantuml'); },
      tokenizer(src: string) {
        const rule = /^```plantuml\n([\s\S]+?)\n```/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'plantUML',
            raw: match[0],
            code: match[1],
            html: '', // will be replaced in walkTokens
          };
        }
      },
      renderer(token) {
        return token.html;
      }
    }],
    async: true,
    async walkTokens(token) {
      if (token.type === 'plantUML') {
        const imgData = await ipcRenderer.invoke('render-plantuml', token.code);
        token.html = `<pre class="plantuml">${imgData}</pre>`;
      }
    }
  };
  
  const mermaidExtension = {
    extensions: [{
      name: 'mermaid',
      level: 'block',
      start(src: string) { return src.indexOf('```mermaid'); },
      tokenizer(src: string) {
        const rule = /^```mermaid\n([\s\S]+?)\n```/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'mermaid',
            raw: match[0],
            text: match[1],
            html: '' // will be replaced in walkTokens
          };
        }
      },
      renderer(token) {
        return token.html;
      }
    }],
    async: true,
    async walkTokens(token) {
      if (token.type === 'mermaid') {
        const { svg } = await mermaid.render('graphDiv', token.text);
        token.html = `<pre class="mermaid">${svg}</pre>`;
      }
    }
  };
  
  marked.use({
    gfm: true,
    renderer: renderer,
  },
  inlineKatex,
  blockKatex,
  plantUMLExtension,
  mermaidExtension
  );
  
  return marked.parse(markdown);
}

async function compileMarkdownAndRender(vm: any) {
  const store = vm.$store;
  const tab = store.state.tabs.find(tab => tab.id === vm.id);
  
  let html;
  let htmlClean;
  let htmlContent;
  
  if (tab && tab.htmlClean) {
    htmlClean = tab.htmlClean;
    postEffectRender(htmlClean, vm.output);
  } else {
    html = await markedRenderer(vm.markdown);
    htmlClean = DOMPurify.sanitize(html);
    postEffectRender(htmlClean, vm.output);
    htmlContent = vm.output.outerHTML;
    store.commit('updateTabHtml', { id: vm.id, htmlClean, htmlContent });
  }

  if (!vm.scrolling) {
    syncScroll(vm);
  }
}

function postEffectRender(html: string, element: HTMLElement) {
  element.innerHTML = html;
  mathRender(element);
  Prism.highlightAllUnder(element);
}

function mathRender(element: HTMLElement) {
  renderMathInElement(element, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });
}

function handleInputScroll(vm: any) {
  vm.draggingInput = true;
  if (!vm.scrolling) {
    vm.scrolling = true;
    syncScroll(vm);
  }
}

function handleOutputScroll(vm: any) {
  vm.draggingInput = false;
  if (!vm.scrolling) {
    vm.scrolling = true;
    syncScroll(vm);
  }
}

function syncScroll(vm: any) {
  const inputScrollTop = vm.input.scrollTop;
  const outputScrollTop = vm.output.scrollTop;
  const inputScrollHeight = vm.input.scrollHeight;
  const outputScrollHeight = vm.output.scrollHeight;

  const inputRatio = inputScrollTop / (inputScrollHeight - vm.input.clientHeight);
  const outputRatio = outputScrollTop / (outputScrollHeight - vm.output.clientHeight);

  if (Math.abs(inputRatio - outputRatio) > 0.001) {
    const inputScrollOffset = (inputScrollHeight - vm.input.clientHeight) * outputRatio;
    const outputScrollOffset = (outputScrollHeight - vm.output.clientHeight) * inputRatio;

    if (vm.draggingInput) {
      vm.output.scrollTop = outputScrollOffset;
    } else {
      vm.input.scrollTop = inputScrollOffset;
    }
  }
  vm.scrolling = false;
}

export default {
  props: {
    id: {
      type: Number,
      required: true,
      default: 0,
      validator: function (value) {
        console.log('id prop updated', value);
        return true;
      }
    }
  },
  setup (props) {
    const store = inject('store') as Store<vuexState>;
    const tab = computed(() => store.state.tabs.find(tab => tab.id === props.id));
    const markdown = ref(tab.value ? tab.value.markdown : '');
    const instance = getCurrentInstance();

    onMounted(() => {
      ipcRenderer.on('perform-find-in-textarea', (_event, { text, direction, useRegex }) => {
        if (instance) {
          const result = findInTextarea(text, direction, useRegex, instance.proxy);
          if (result) {
            ipcRenderer.send('find-in-editor-match-result', {
              currentMatchIndex: result.currentMatchIndex,
              totalMatches: result.totalMatches
            });
          }
        }
      });
      ipcRenderer.on('execute-find-replace-text', (_event, { findText, direction, useRegex }) => {
        if (instance) {
          const replaceText = '';
          const replaceAll = false;
          const replacementResult = replaceEditorText(
            markdown.value,
            findText,
            replaceText,
            useRegex,
            replaceAll,
            direction,
            instance.proxy
          );
          if (replacementResult) {
            ipcRenderer.send('find-in-editor-match-result', {
              currentMatchIndex: replacementResult.currentMatchIndex,
              totalMatches: replacementResult.totalMatches
            });
          }
        }
      });
      ipcRenderer.on('execute-replace', (_event, { findText, replaceText, useRegex, replaceAll }) => {
        const direction = 'now';
        if (instance) {
          const replacementResult = replaceEditorText(
            markdown.value,
            findText,
            replaceText,
            useRegex,
            replaceAll,
            direction,
            instance.proxy
          );
          markdown.value = replacementResult.newMarkdown;
        }
      });
    });

    onBeforeUnmount(() => {
      ipcRenderer.removeAllListeners('perform-find-in-textarea');
      ipcRenderer.removeAllListeners('execute-find-replace-text');
      ipcRenderer.removeAllListeners('execute-replace');
    });

    watch(markdown, (newMarkdown) => {
      store.commit('updateTabMarkdown', { id: props.id, markdown: newMarkdown })
      if (instance) {
        compileMarkdownAndRender(instance.proxy);
      }
    })

    return {
      markdown,
    }
  },
  data() {
    return {
      draggingInput: false,
      scrolling: false,
      input: null as any,
      output: null as any,
      inputEventHandler: null as any,
      inputScrollHandler: null as any,
      outputScrollHandler: null as any,
    };
  },
  mounted() {
    this.initMarkdownEditor();

    if(this.markdown !== '') {
      const debouncedCompileMarkdownAndRender = debounce(compileMarkdownAndRender, 10);
      debouncedCompileMarkdownAndRender(this);
    }
  },
  beforeDestroy() {
    const debouncedCompileMarkdownAndRender = debounce(compileMarkdownAndRender, 100);
    this.inputEventHandler = () => debouncedCompileMarkdownAndRender(this);
    this.inputScrollHandler = () => handleInputScroll(this);
    this.outputScrollHandler = () => handleOutputScroll(this);
    this.input.removeEventListener("input", this.inputEventHandler);
    this.input.removeEventListener("input", this.inputScrollHandler);
    this.output.removeEventListener("input", this.outputScrollHandler);
    this.input = null;
    this.output = null;
  },
  methods: {
    initMarkdownEditor() {
      this.input = this.$refs.inputBox as HTMLElement;
      this.output = this.$refs.outputBox as HTMLElement;

      const debouncedCompileMarkdownAndRender = debounce(compileMarkdownAndRender, 100);
      this.inputEventHandler = () => debouncedCompileMarkdownAndRender(this);
      this.inputScrollHandler = () => handleInputScroll(this);
      this.outputScrollHandler = () => handleOutputScroll(this);

      this.input.addEventListener("input", this.inputEventHandler);
      this.input.addEventListener("scroll", this.inputScrollHandler);
      this.output.addEventListener("scroll", this.outputScrollHandler);      
    },
  }
}
</script>
  
<style scoped>
html,
body {
  overflow: hidden; /* 隐藏页面的滚动条 */
}

#app {
  margin: 0;
  display: flex;
  height: 100%;
  width: 100%;
  font-family: "Helvetica Neue", Arial, sans-serif;
  color: #333;
}

.input,
.output {
  width: 50%;
  box-sizing: border-box;
}

.input {
  border: none;
  border-right: 1px solid #ccc;
  resize: none;
  outline: none;
  background-color: #f6f6f6;
  border: 1px solid #000000; /* 添加边框 */
  font-size: 14px;
  font-family: "Monaco", courier, monospace;
  padding: 20px;
  min-height: 96vh;
  max-height: 96vh;
  overflow: auto;
}

.output {
  border: 1px solid #000000; /* 添加边框 */
  padding: 0 20px;
  min-height: 96vh;
  max-height: 96vh;
  overflow: auto;
}
</style>