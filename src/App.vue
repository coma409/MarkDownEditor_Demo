<template>
  <div id="app">
    <nav class="tab-bar">
      <div class="tab" v-for="tab in tabs" :key="tab.id">
        <input v-if="tab.editing" type="text" v-model="tab.title" @blur="finishEditing(tab)" @keyup.enter="finishEditing(tab)">
        <button v-else @click="setActiveTab(tab.path)" @dblclick="startEditing(tab)">{{ tab.title }}</button>
        <button @click="deleteTab(tab.id)">X</button>
      </div>
      <button @click="createTab">New Tab</button>
    </nav>
    <router-view :key="fullPath"></router-view>
  </div>
</template>

<script lang="ts">
import { computed, onMounted, onBeforeUnmount, provide, createVNode, render } from 'vue'
import { useStore, Store } from 'vuex'
import { useRouter, useRoute } from 'vue-router'
import { vuexState, Tab } from './store'
import TemplateComponent from './components/TemplateComponent.vue';

const ipcRenderer = window.electron.ipcRenderer;

function saveAs (store: Store<vuexState>) {
  const activeTab = store.state.tabs.find(tab => tab.path === store.state.activeTab);
  if (activeTab) {

    const vnode = createVNode(TemplateComponent, { html: activeTab.htmlContent });
    const container = document.createElement('div');

    render(vnode, container);

    const htmlContent = container.innerHTML;

    ipcRenderer.send('save-as', {
      tabId: activeTab.id,
      fileName: activeTab.title,
      markdownContent: activeTab.markdown,
      htmlContent: htmlContent
    });

    render(null, container);
  }
}

function saveFile (store: Store<vuexState>) {
  const activeTab = store.state.tabs.find(tab => tab.path === store.state.activeTab);
  if (activeTab) {
    ipcRenderer.send('save-file', { filePath: activeTab.filePath, content: activeTab.markdown })
  }
}

function saveAllFiles (store: Store<vuexState>) {
  store.state.tabs
    .filter(tab => tab.filePath)
    .forEach(tab => {
      ipcRenderer.send('save-file', { filePath: tab.filePath, content: tab.markdown });
    });
}

export default {
  name: 'App',
  setup () {
    const store = useStore() as Store<vuexState>;
    provide('store', store)
    const router = useRouter()
    const route = useRoute()
    const fullPath = computed(() => route.fullPath)
    const tabs = computed(() => store.state.tabs)

    const setActiveTab = (path: string) => {
      store.commit('setActiveTab', path)
      router.push(path)
    }
    const startEditing = (tab: Tab) => {
      store.commit('startEditing', tab)
    }
    const finishEditing = (tab: Tab) => {
      store.commit('finishEditing', tab)
    }
    const createTab = () => {
      store.dispatch('createTab')
    }
    const deleteTab = (id: number) => {
      store.dispatch('deleteTab', id)
    }

    const handleSaveAs = () => saveAs(store);
    const handleSaveFiles = () => saveFile(store);
    const handleSaveAllFiles = () => saveAllFiles(store);

    onMounted(() => {
      ipcRenderer.on('create-tab', (_event, { fileName, filePath, content }) => {
        store.commit('createTabFromFile', { title: fileName, filePath: filePath, markdown: content});
      });
      ipcRenderer.on('save-file', handleSaveFiles);
      ipcRenderer.on('save-all-file', handleSaveAllFiles);
      ipcRenderer.on('save-file-result', (_event, result) => {
        if (result.success) {
          console.log(result.message);
        } else {
          console.error(result.message);
        }
      });
      ipcRenderer.on('save-as', handleSaveAs);
      ipcRenderer.on('filepath', (_event, { tabId, fileName, filePath }) => {
        store.commit('updateFileData', { tabId, fileName, filePath })
      });
    })

    onBeforeUnmount(() => {
      ipcRenderer.removeAllListeners('create-tab');
      ipcRenderer.removeAllListeners('save-file');
      ipcRenderer.removeAllListeners('save-all-file');
      ipcRenderer.removeAllListeners('save-file-result');
      ipcRenderer.removeAllListeners('save-as');
      ipcRenderer.removeAllListeners('filepath');
    });

    return {
      tabs,
      setActiveTab,
      startEditing,
      finishEditing,
      createTab,
      deleteTab,
      fullPath
    }
  }
}
</script>

<style>
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  padding: 4px;
  gap: 5px;
}

.tab {
  display: flex;
  gap: 5px;
}
</style>