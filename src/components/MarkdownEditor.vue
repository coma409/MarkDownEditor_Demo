<template>
  <div id="app">
    <textarea class="input" ref="inputBox" placeholder="在此输入 Markdown 文本" v-model="markdown"></textarea>
    <div class="output" ref="outputBox"></div>
  </div>
</template>
  
<script lang="ts">
import * as marked from "marked";
import Prism from "prismjs";
import "katex/dist/katex.min.js";
import "katex/dist/katex.min.css";
import "prismjs/themes/prism-solarizedlight.css";
import renderMathInElement from "katex/dist/contrib/auto-render.js";
import mermaid from "mermaid";

declare global {
interface Window {
    electron: {
      ipcRenderer: Electron.IpcRenderer;
    };
  }
}
const ipcRenderer = window.electron.ipcRenderer;

//const input: HTMLElement = this.$refs.inputBox as HTMLElement;
//const output: HTMLElement = this.$refs.outputBox as HTMLElement;

export default {
  created() {
    ipcRenderer.on('plantuml-path', (_event, plantuml_jar_path) => {
      console.log(plantuml_jar_path);
    })
    ipcRenderer.on('export-file', this.exportFile)
    ipcRenderer.on('file-opened', (_event, arg) => {
      this.markdown = arg.content;
      this.compileMarkdownAndRender();
    })
  },
  data() {
    return {
      markdown: "",
      draggingInput: false,
      scrolling: false,
      input: null as any,
      output: null as any
    };
  },
  mounted() {
    this.initMarkdownEditor();
  },
  methods: {
    initMarkdownEditor() {
      this.input = this.$refs.inputBox as HTMLElement;
      this.output = this.$refs.outputBox as HTMLElement;

      this.input.addEventListener("input", this.debounce(this.compileMarkdownAndRender, 100));
      this.input.addEventListener("scroll", this.handleInputScroll);
      this.output.addEventListener("scroll", this.handleOutputScroll);
    },
    markedRenderer(markdown: string) {
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
        if (lang === "plantuml") {
          const imgData = ipcRenderer.sendSync('render-plantuml', code);
          return `<pre class="plantuml">${imgData}</pre>`;
        }
        if (lang === "mermaid") {
          return `<pre class="mermaid">${code}</pre>`;
        }
        if (!lang) {
          return `<pre><code class="language-none">${code}</code></pre>`;
        }
        return marked.Renderer.prototype.code.call(this, code, lang, escaped);
      };

      renderer.codespan = function (code: string) {
        return `<div><code class="language-none">${code}</code></div>`;
      }

      const inlineKatex = {
        name: 'inlineKatex',
        level: 'inline',
        start(src: string) { return src.indexOf('$'); },
        tokenizer(src: string) {
          const match = src.match(/^\$+([\s\S]*?)\$+/);
          if (match) {
            const token = {
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
      };
      
      const blockKatex = {
        name: 'blockKatex',
        level: 'block',
        start(src: string) { return src.indexOf('$$'); },
        tokenizer(src: string) {
          const match = src.match(/^\$\$+([\s\S]*?)\$\$+/);
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
      };
  
      marked.use({
//        mangle: false,
//        headerIds: false,
        gfm: true,
        renderer: renderer,
      },
      { extensions: [blockKatex, inlineKatex] },
      );

      return marked.parse(markdown);
    },
    debounce(func: Function, wait: number) {
      let timeout: NodeJS.Timeout;
      return function (this: any) {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          func.apply(context, args);
        }, wait);
      };
    },
    compileMarkdownAndRender() {
      const html = this.markedRenderer(this.markdown);
      this.output.innerHTML = html;
      this.renderMathInElement(this.output);
      mermaid.init();
      Prism.highlightAllUnder(this.output);

      if (!this.scrolling) {
        this.syncScroll();
      }
    },
    handleInputScroll() {
      this.draggingInput = true;
      if (!this.scrolling) {
        this.scrolling = true;
        this.syncScroll();
      }
    },
    handleOutputScroll() {
      this.draggingInput = false;
      if (!this.scrolling) {
        this.scrolling = true;
        this.syncScroll();
      }
    },
    syncScroll() {
      const inputScrollTop = this.input.scrollTop;
      const outputScrollTop = this.output.scrollTop;
      const inputScrollHeight = this.input.scrollHeight;
      const outputScrollHeight = this.output.scrollHeight;

      const inputRatio = inputScrollTop / (inputScrollHeight - this.input.clientHeight);
      const outputRatio = outputScrollTop / (outputScrollHeight - this.output.clientHeight);

      if (Math.abs(inputRatio - outputRatio) > 0.001) {
        const inputScrollOffset = (inputScrollHeight - this.input.clientHeight) * outputRatio;
        const outputScrollOffset = (outputScrollHeight - this.output.clientHeight) * inputRatio;

        if (this.draggingInput) {
          this.output.scrollTop = outputScrollOffset;
        } else {
          this.input.scrollTop = inputScrollOffset;
        }
      }
      this.scrolling = false;
    },
    renderMathInElement(element: HTMLElement) {
      renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    },
    exportFile() {
      const markdownContent = this.markdown;
      const htmlContent = this.output.innerHTML;
      ipcRenderer.send('export-file', {
        markdownContent,
        htmlContent  
      })
    },
  }
};
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
  font-size: 14px;
  font-family: "Monaco", courier, monospace;
  padding: 20px;
  min-height: 98.4vh;
  max-height: 99vh;
  overflow: auto;
}

.output {
  padding: 0 20px;
  min-height: 98.4vh;
  max-height: 99vh;
  overflow: auto;
}
</style>  