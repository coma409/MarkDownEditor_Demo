import { app, BrowserWindow, ipcMain, Menu, MenuItem, dialog , shell} from 'electron'
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
let auxiliaryWindow: BrowserWindow | null = null;
let plantumlServerProcess: childProcess.ChildProcess;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const plantuml_jar_path = app.isPackaged ? path.join(app.getAppPath(), '../lib') : path.join(process.env.DIST, '../lib');
const plantuml_jar = path.join(plantuml_jar_path, 'plantuml.jar')

const windowSizes = {
  'show-replace-dialog': { width: 360, height: 170 },
  'show-find-dialog': { width: 360, height: 110 },
};

function createMenu() {
  const defaultMenu = Menu.getApplicationMenu()
  const fileMenuIndex = menuIndex(defaultMenu!, 'File')
  const exitMenuIndex = submenuIndex(defaultMenu!, fileMenuIndex, 'Exit')
  const editMenuIndex = menuIndex(defaultMenu!, 'Edit')
  const selectAllMenuIndex = submenuIndex(defaultMenu!, editMenuIndex, 'Select All')

  defaultMenu?.items[fileMenuIndex].submenu?.insert(exitMenuIndex,
    new MenuItem({
      label: 'Save As', 
      click: () => {
        channelSend('save-as')
      }
    })
  )

  defaultMenu?.items[fileMenuIndex].submenu?.insert(exitMenuIndex,
    new MenuItem({
      label: 'Save All Files', 
      click: () => {
        channelSend('save-all-file')
      },
    })
  )

  defaultMenu?.items[fileMenuIndex].submenu?.insert(exitMenuIndex,
    new MenuItem({
      label: 'Save File', 
      click: () => {
        channelSend('save-file')
      },
//      accelerator: 'CmdOrCtrl+S'
    })
  )

  defaultMenu?.items[fileMenuIndex].submenu?.insert(exitMenuIndex,
    new MenuItem({
      label: 'Open File', 
      click: () => {
        openFile()
      }
    })
  )

  defaultMenu?.items[editMenuIndex].submenu?.insert(selectAllMenuIndex,
    new MenuItem({
      label: 'Replace Tex', 
      click: () => {
        showAuxiliaryWindow('show-replace-dialog');
      },
//      accelerator: 'CmdOrCtrl+S'
    })
  )

  defaultMenu?.items[editMenuIndex].submenu?.insert(selectAllMenuIndex,
    new MenuItem({
      label: 'Search Tex', 
      click: () => {
        showAuxiliaryWindow('show-find-dialog');
      },
//      accelerator: 'CmdOrCtrl+F'
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

function channelSend(channel: string) {
  win?.webContents.send(channel)
}

function openFile() {
  dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] }
    ]
  }).then(result => {
    if(!result.canceled) {
      result.filePaths.forEach(filePath => {
        fs.readFile(filePath, 'utf-8', (_err, content) => {
          const fileName = path.parse(filePath).name;
          createTab(fileName, filePath, content);
        });
      });
    }
  });
}

function createTab(fileName: string, filePath: string, content: string) {
  win?.webContents.send('create-tab', { fileName, filePath, content });
}

function saveFileAsListener() {
  ipcMain.on('save-as', (_event, { tabId, fileName, markdownContent, htmlContent }) => {
    saveFileAs(tabId, fileName, markdownContent, htmlContent)
  })
}

function saveFileAs(tabId: number, filename: string, markdown: string, html: string) {
  dialog.showSaveDialog({
    title: 'Save As',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'HTML', extensions: ['html'] }
    ],
    defaultPath: path.join(__dirname, filename)
  }).then(result => {
    if(!result.canceled) {
      if(typeof result.filePath === 'string') {
        const parsedPath = path.parse(result.filePath);
        const ext = parsedPath.ext;
        const content = ext === '.md' ? markdown : html;
        fs.writeFileSync(result.filePath, content);
        if (ext === '.md') {
          const fileName = parsedPath.name;
          updateFileData(tabId, fileName, result.filePath);
        }
      } else {
        console.log('Invalid file path') 
      }
    }
  }).catch(err => {
    console.log(err)
  })
}

function updateFileData(tabId: number, fileName: string, filePath: string) {
  win?.webContents.send('filepath', { tabId, fileName, filePath });
}

function saveFileListener() {
  ipcMain.on('save-file', (event, { filePath, content }) => {
    writeFile(filePath, content, (err) => {
      if (err) {
        // Handle error
        console.error(`Failed to save file ${filePath}: ${err}`)
        event.reply('save-file-result', { success: false, message: `Failed to save file: ${err}` })
      } else {
        event.reply('save-file-result', { success: true, message: 'File saved successfully' })
      }
    })
  })
}

function writeFile(filePath: string, content: string, callback: (err: NodeJS.ErrnoException | null) => void) {
  fs.writeFile(filePath, content, 'utf8', callback);
}

function plantUMLServer() {
  ipcMain.handle('render-plantuml', async (_event, code) => {
    plantumlServerProcess = childProcess.spawn('java', ['-jar', plantuml_jar, '-pipe', '-tsvg']);
    plantumlServerProcess.stdin?.write(code);
    plantumlServerProcess.stdin?.end();
    let imgData = '';
    return new Promise((resolve) => {
      plantumlServerProcess.stdout?.on('data', (data) => {
        imgData += data.toString();
      });
      plantumlServerProcess.stdout?.on('end', () => {
        resolve(imgData);
      });
    });
  });
}

function stopServer() {
  if (plantumlServerProcess) {
    plantumlServerProcess.kill('SIGTERM');
  }
}

function editorListener() {
  ipcMain.on('find-in-editor', (_event, { text, direction, useRegex }) => {
    updateSearchText(text, direction, useRegex);
  });

  ipcMain.on('find-in-editor-match-result', (_event, { currentMatchIndex, totalMatches }) => {
    updateMatchResult(currentMatchIndex, totalMatches);
  });
  
  ipcMain.on('find-replace-text-in-editor', (_event, { findText, direction, useRegex }) => {
    updateFindReplaceText(findText, direction, useRegex);
  });

  ipcMain.on('replace-in-editor', (_event, { findText, replaceText, useRegex, replaceAll }) => {
    updateReplaceText(findText, replaceText, useRegex, replaceAll);
  });

  ipcMain.on('close-auxiliary-window', () => {
    if (auxiliaryWindow) {
      auxiliaryWindow.close();
    }
  });
}

function updateSearchText(text: string, direction: string, useRegex: boolean) {
  win?.webContents.send('perform-find-in-textarea', { text, direction, useRegex });
}

function updateMatchResult(currentMatchIndex: number, totalMatches: number) {
  auxiliaryWindow?.webContents.send('display-match-result', { currentMatchIndex, totalMatches });
}

function updateFindReplaceText(findText: string, direction: string, useRegex: boolean) {
  win?.webContents.send('execute-find-replace-text', { findText, direction, useRegex });
}

function updateReplaceText(findText: string, replaceText: string, useRegex: boolean, replaceAll: boolean) {
  win?.webContents.send('execute-replace', { findText, replaceText, useRegex, replaceAll });
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.PUBLIC, 'electron-vite.svg'),
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
//      webviewTag: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  win.on('close', () => {
    win = null
  });
}

function showAuxiliaryWindow(eventToSend: string) {
  if (auxiliaryWindow) {
    auxiliaryWindow.focus();
    return;
  }

  if (!win) {
    console.error('The main window is not initialized and cannot create an auxiliary window.');
    return;
  }

  const { width, height } = windowSizes[eventToSend] || { width: 360, height: 170 };

  auxiliaryWindow = new BrowserWindow({
    width,
    height,
    frame: false,
    parent: win,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  auxiliaryWindow.setMenu(null);

  if (VITE_DEV_SERVER_URL) {
    auxiliaryWindow.loadURL(`${VITE_DEV_SERVER_URL}#/auxiliary`); // 假设你的辅助窗口路由是 '/auxiliary'
  } else {
    auxiliaryWindow.loadFile(path.join(process.env.DIST, 'index.html'), { hash: 'auxiliary' });
  }

  auxiliaryWindow.on('closed', () => {
    auxiliaryWindow = null;
  });

  auxiliaryWindow?.webContents.once('dom-ready', () => {
    auxiliaryWindow?.webContents.send(eventToSend);
  });
}

app.on('ready', () => {
  createWindow()
  createMenu()
  plantUMLServer()
  saveFileListener()
  saveFileAsListener()
  editorListener()
});

app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') app.quit();
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});