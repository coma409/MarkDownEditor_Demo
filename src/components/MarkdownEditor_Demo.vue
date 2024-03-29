<template>
  <div id="app">
    <textarea class="input" ref="inputBox"  :style="{ top: editorHeight }" placeholder="在此输入 Markdown 文本" v-model="markdown"></textarea>
    <div class="output" ref="outputBox" :style="{ top: editorHeight }"></div>
  </div>
</template>
  
<script lang="ts">
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash.min.js';
import 'prismjs/components/prism-c.min.js';
import 'prismjs/components/prism-cpp.min.js';
import 'prismjs/components/prism-csharp.min.js';
import 'prismjs/components/prism-css.min.js';
import 'prismjs/components/prism-go.min.js';
import 'prismjs/components/prism-java.min.js';
import 'prismjs/components/prism-javascript.min.js';
import 'prismjs/components/prism-json.min.js';
import 'prismjs/components/prism-json5.min.js';
import 'prismjs/components/prism-kotlin.min.js';
import 'prismjs/components/prism-latex.min.js';
import 'prismjs/components/prism-markup.min.js';
import 'prismjs/components/prism-powershell.min.js';
import 'prismjs/components/prism-python.min.js';
import 'prismjs/components/prism-rust.min.js';
import 'prismjs/components/prism-sql.min.js';
import 'prismjs/components/prism-typescript.min.js';
import 'prismjs/components/prism-yaml.min.js';
import 'prismjs/themes/prism-solarizedlight.css';
import 'katex/dist/katex.min.js';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { ref, watch, computed, onMounted, onBeforeUnmount, inject, getCurrentInstance } from 'vue'
import { Store } from 'vuex'
import { vuexState } from '../store'
import { findInTextarea, replaceEditorText } from '../methods/searchandreplace.ts';
import { debounce } from '../methods/debounce.ts';
import { markedRenderer, mathRender } from '../methods/markedrenderer.ts';
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
  
  if (tab && tab.htmlClean && tab.htmlContent) {
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
    const autoRender = ref(store.state.autorender);
    const instance = getCurrentInstance();
    const editorHeight = computed(() => {
      return store.state.overflow ? '50px' : '33px';
    });

    onMounted(() => {
//      ipcRenderer.on('print-path', (_event, { lib_path, plantuml_jar, graphvizDotPath }) => {
//        console.log('lib_path: ', lib_path);
//        console.log('plantuml_jar: ', plantuml_jar);
//        console.log('graphvizDotPath: ', graphvizDotPath);
//      });
      ipcRenderer.on('toggle-auto-render', (_event, { autoRenderEnabled }) => {
        store.commit('updateTabAutoRender', { autorender: autoRenderEnabled })
        autoRender.value = store.state.autorender;
        console.log("autoRender is " + autoRender.value);
        if (instance && autoRender.value) {
          compileMarkdownAndRender(instance.proxy);
        }
      });
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
//      ipcRenderer.removeAllListeners('print-path');
      ipcRenderer.removeAllListeners('toggle-auto-render');
      ipcRenderer.removeAllListeners('perform-find-in-textarea');
      ipcRenderer.removeAllListeners('execute-find-replace-text');
      ipcRenderer.removeAllListeners('execute-replace');
    });

    watch(markdown, (newMarkdown) => {
      store.commit('updateTabMarkdown', { id: props.id, markdown: newMarkdown })
      if (instance && autoRender.value) {
        compileMarkdownAndRender(instance.proxy);
      }
    })

    return {
      markdown,
      autoRender,
      editorHeight,
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
//    document.removeEventListener('keydown', this.handleKeydown);
    this.inputEventHandler = () => {
      if (this.autoRender) {
       debouncedCompileRender(this, 100)
      }
    };
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

//      document.addEventListener('keydown', this.handleKeydown);
      this.inputEventHandler = () => {
        if (this.autoRender) {
         debouncedCompileRender(this, 100)
        }
      };
      this.inputScrollHandler = () => handleInputScroll(this);
      this.outputScrollHandler = () => handleOutputScroll(this);

      this.input.addEventListener("input", this.inputEventHandler);
      this.input.addEventListener("scroll", this.inputScrollHandler);
      this.output.addEventListener("scroll", this.outputScrollHandler);      
    },
//    handleKeydown(event) {
//      if (event.altKey && event.key === 'r') {
//        this.handleManualRender();
//      }
//    },
//    handleManualRender() {
//      if (!this.autoRender) {
//        compileMarkdownAndRender(this); // 当 autoRender 为 false 时，手动触发渲染
//      }
//    },
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
  border-top: 1px solid #000000;
  border-left: 1px solid #000000;
  border-bottom: 1px solid #000000;
  font-size: 14px;
  font-family: "Monaco", courier, monospace;
  padding: 20px;
  position: absolute;
  left: 1px;
  right: 50;
  bottom: 1px;
  overflow: auto;
}

.output {
  border-top: 1px solid #000000;
  border-right: 1px solid #000000;
  border-bottom: 1px solid #000000;
  padding: 0 20px;
  position: absolute;
  left: 50;
  right: 1px;
  bottom: 1px;
  overflow: hidden;
}
</style>