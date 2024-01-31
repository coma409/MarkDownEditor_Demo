import { app, BrowserWindow, ipcMain, IpcMainEvent, Menu, MenuItem, dialog } from 'electron'
import childProcess from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
let plantumlServerProcess: childProcess.ChildProcess;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const openedFiles: { [filePath: string]: BrowserWindow } = {};
const plantuml_jar_path = app.isPackaged ? path.join(app.getAppPath(), '../lib') : path.join(process.env.DIST, '../lib');
const plantuml_jar = path.join(plantuml_jar_path, 'plantuml.jar')

function createMenu() {
  const defaultMenu = Menu.getApplicationMenu()
  const fileMenuIndex = menuIndex(defaultMenu!, 'File')
  const exitMenuIndex = submenuIndex(defaultMenu!, fileMenuIndex, 'Exit')

  defaultMenu?.items[fileMenuIndex].submenu?.insert(exitMenuIndex,
    new MenuItem({
      label: 'Save As', 
      click: () => {
        exportChannelSend('export-file')
      }
    })
  )

  defaultMenu?.items[fileMenuIndex].submenu?.insert(exitMenuIndex,
    new MenuItem({
      label: 'Open file', 
      click: () => {
        openFile()
      }
    })
  )

  Menu.setApplicationMenu(defaultMenu)
}

function menuIndex(Menu: Electron.Menu, title: string) {
  return Menu?.items.findIndex(item => item.label === title) as number
}

function submenuIndex(Menu: Electron.Menu, MenuIndex: number, title: string) {
  return Menu?.items[MenuIndex].submenu?.items?.findIndex(item => item.label === title) as number
}

function openFile() {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] }
    ]
  }).then(result => {
    if(!result.canceled) {
      const filePath = result.filePaths[0]

      // 读取文件内容
      fs.readFile(filePath, 'utf-8', (_err, content) => {
        // 创建标签页
        createTab(filePath, content);
        // 通过 IPC 发送给渲染进程
//        win?.webContents.send('file-opened', {
//          filePath,
//          content  
//        })
      })
    }
  })
}

function createTab(filePath: string, content: string) {

  const tabWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  openedFiles[filePath] = tabWindow; // 将文件路径和对应的窗口实例存储起

  tabWindow.webContents.on('did-finish-load', () => {
    // 将文件内容传递给渲染进程
    tabWindow.webContents.send('file-opened', {
      filePath,
      content
    });
  });

  if (VITE_DEV_SERVER_URL) {
    tabWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    tabWindow.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  tabWindow.on('closed', () => {
    delete openedFiles[filePath]; // 标签页关闭时，从已打开的文件列表中移除
  });
}

function exportFile(content: string, Path: string) {
  if(typeof Path === 'string') {
    fs.writeFileSync(Path, content);
  } else {
    console.log('Invalid file path') 
  }
}

function saveAs(markdown: string, html: string) {
  dialog.showSaveDialog({
    title: 'Save As',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'HTML', extensions: ['html'] }
    ] 
  }).then(result => {
    if(!result.canceled) {
      if(typeof result.filePath === 'string') {
        const ext = path.extname(result.filePath);
        if (ext === '.md') {
          exportFile(markdown, result.filePath);
        } else if (ext === '.html') {
          exportFile(html, result.filePath); 
        }
      } else {
        console.log('Invalid file path') 
      }
    }
  }).catch(err => {
    console.log(err)
  })
}

function exportChannelSend(channel: string) {
  win?.webContents.send(channel)
}

function exportListener() {
  ipcMain.on('export-file', (_event, arg) => {
    saveAs(arg.markdownContent, arg.htmlContent)
  })
}

function plantUMLServer() {
  ipcMain.on('render-plantuml', (event: IpcMainEvent, code) => {
//    const imgData = generate(code, { format: 'svg' });
//    event.returnValue = imgData;
    plantumlServerProcess = childProcess.spawn('java', ['-jar', plantuml_jar, '-pipe', '-tsvg']);
    plantumlServerProcess.stdin?.write(code);
    plantumlServerProcess.stdin?.end();
    let imgData = '';
    plantumlServerProcess.stdout?.on('data', (data) => {
      imgData += data.toString();
    });
    plantumlServerProcess.stdout?.on('end', () => {
      event.returnValue = imgData;
    });
    event.reply('plantuml-path', plantuml_jar_path);
  });
}

function stopServer() {
  if (plantumlServerProcess) {
    plantumlServerProcess.kill('SIGTERM');
  }
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.PUBLIC, 'electron-vite.svg'),
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
//      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
  
  win.on('close', () => {
    win = null
  });
}

app.on('ready', () => {
  createWindow()
  createMenu()
  plantUMLServer()
  exportListener()
});

app.on('window-all-closed', () => {
  stopServer()
})