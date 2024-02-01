<template>
  <div id="app">
    <textarea class="input" ref="inputBox" placeholder="在此输入 Markdown 文本" v-model="markdown"></textarea>
    <div class="output" ref="outputBox"></div>
  </div>
</template>
  
<script lang="ts">
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
import { findInTextarea, replaceEditorText } from '../methods/searchandreplace.ts';
import { debounce } from '../methods/debounce.ts';
import { markedRenderer } from '../methods/markedrenderer.ts';
import { handleInputScroll, handleOutputScroll, syncScroll } from '../methods/syncscroll.ts';

mermaid.initialize({ startOnLoad: false });

declare global {
interface Window {
    electron: {
      ipcRenderer: Electron.IpcRenderer;
    };
  }
}

const ipcRenderer = window.electron.ipcRenderer

const ipcMethods = {
  invoke: ipcRenderer.invoke
};

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $store: Store<vuexState>;
  }
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
    html = await markedRenderer(vm.markdown, ipcMethods);
    htmlClean = DOMPurify.sanitize(html);
    postEffectRender(htmlClean, vm.output);
    htmlContent = vm.output.outerHTML;
    store.commit('updateTabHtml', { id: vm.id, htmlClean, htmlContent });
  }
}

function debouncedCompileRender (vm: any, time: number) {
  const debouncedCompileMarkdownAndRender = debounce(compileMarkdownAndRender, time);
  debouncedCompileMarkdownAndRender(vm);
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
        if (instance) {
          const direction = 'now';
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
      debouncedCompileRender(this, 10);
    }
  },
  beforeDestroy() {
    this.inputEventHandler = () => debouncedCompileRender(this, 100);
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

      this.inputEventHandler = () => debouncedCompileRender(this, 100);
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
  overflow: hidden;
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
  border: 1px solid #000000;
  font-size: 14px;
  font-family: "Monaco", courier, monospace;
  padding: 20px;
  min-height: 96vh;
  max-height: 96vh;
  overflow: auto;
}

.output {
  border: 1px solid #000000;
  padding: 0 20px;
  min-height: 96vh;
  max-height: 96vh;
  overflow: auto;
}
</style>