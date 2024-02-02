import { createStore } from 'vuex'

export interface Tab {
  id: number;
  title: string;
  path: string;
  editing: boolean;
  markdown: string;
  htmlClean: string;
  htmlContent: string;
  filePath: string;
  findText: string;
  replaceText: string;
  useRegex: boolean;
}

export interface vuexState {
  tabs: Tab[];
  activeTab: string;
  nextTabId: number;
  autorender: boolean;
  overflow: boolean;
}

export default createStore({
  state: {
    tabs: [
      { id: 1, title: 'Tab1', path: '/tab1', editing: false, markdown: '', htmlInner: '', htmlOuter: '', filePath: '', findText: '', replaceText: '', useRegex: false }
    ],
    activeTab: '',
    nextTabId: 2,
    autorender: true,
    overflow: false,
  },
  mutations: {
    setActiveTab (state: vuexState, path: string) {
      state.activeTab = path
    },
    updateTabAutoRender (state: vuexState, { autorender }) {
      state.autorender = autorender
    },
    updateTabOverFlow (state: vuexState, { overflow }) {
      state.overflow = overflow
    },
    updateTabMarkdown (state: vuexState, { id, markdown }) {
      const tab = state.tabs.find(tab => tab.id === id)
      if (tab) {
        tab.markdown = markdown
        tab.htmlClean = ''
        tab.htmlContent = ''
      }
    },
    updateTabHtml (state: vuexState, { id, htmlClean, htmlContent }) {
      const tab = state.tabs.find(tab => tab.id === id)
      if (tab) {
        tab.htmlClean = htmlClean
        tab.htmlContent = htmlContent
      }
    },
    updateFileData (state: vuexState, { tabId, fileName, filePath }) {
      const tab = state.tabs.find(tab => tab.id === tabId)
      if (tab) {
        tab.title = fileName
        tab.filePath = filePath
      }
    },
    setReplaceText (state: vuexState, { tabPath, findText, replaceText, useRegex }) {
      const tab = state.tabs.find(tab => tab.path === tabPath)
      if (tab) {
        tab.findText = findText
        tab.replaceText = replaceText
        tab.useRegex = useRegex
        console.log('tab.path is ' + tab.path)
        console.log('tab.searchText is ' + tab.findText)
        console.log('tab.replaceText is ' + tab.replaceText)
        console.log('tab.useRegex is ' + tab.useRegex)
      }
    },
    startEditing (tab: Tab) {
      tab.editing = true
    },
    finishEditing (tab: Tab) {
      tab.editing = false
    },
    createTab (state: vuexState) {
      state.tabs.push({ id: state.nextTabId, title: `Tab${state.nextTabId}`, path: `/tab${state.nextTabId}`, editing: false, markdown: '', htmlClean: '', htmlContent: '', filePath: '', findText: '', replaceText: '', useRegex: false })
      state.nextTabId++
    },
    createTabFromFile (state: vuexState, { title, filePath, markdown }) {
      state.tabs.push({ id: state.nextTabId, title, path: `/tab${state.nextTabId}`, editing: false, markdown, htmlClean: '', htmlContent: '', filePath, findText: '', replaceText: '', useRegex: false })
      state.nextTabId++
    },
    deleteTab (state: vuexState, id: number) {
      const index = state.tabs.findIndex(tab => tab.id === id)
      if (index !== -1) {
        state.tabs.splice(index, 1)
      }
      state.nextTabId--
    }
  },
  actions: {
    createTab ({ commit }) {
      commit('createTab')
    },
    deleteTab ({ commit }, id: number) {
      commit('deleteTab', id)
    },
  },
  modules: {
  }
})
