// markedrenderer.ts
import * as marked from 'marked';
import mermaid from 'mermaid';

export interface IpcRendererMethods {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

export async function markedRenderer(markdown: string, ipcMethods: IpcRendererMethods) {
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
        const imgData = await ipcMethods.invoke('render-plantuml', token.code);
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