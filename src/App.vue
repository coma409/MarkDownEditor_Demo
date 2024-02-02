<template>
  <div class="app">
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
import { computed, onMounted, onBeforeUnmount, provide, createVNode, render, getCurrentInstance } from 'vue'
import { useStore, Store } from 'vuex'
import { useRouter, useRoute } from 'vue-router'
import { vuexState, Tab } from './store'
import TemplateComponent from './components/TemplateComponent.vue';

const ipcRenderer = window.electron.ipcRenderer;

function checkTabsOverflow(store: Store<vuexState>, vm: any) {
  const tabBar = vm.$el.querySelector('.tab-bar');
  const tabBarWidth = store.state.nextTabId * 83.125;
  const hasOverflow = tabBarWidth > tabBar.clientWidth;
  store.commit('updateTabOverFlow', { overflow: hasOverflow })
//  console.log('tabBarWidth is ' + tabBarWidth);
//  console.log('scrollWidth is ' + tabBar.scrollWidth);
//  console.log('clientWidth is ' + tabBar.clientWidth);
//  console.log('hasOverflow is ' + hasOverflow);
}

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
    const instance = getCurrentInstance();

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
      if (instance) {
        checkTabsOverflow(store, instance.proxy)
      }
    }
    const deleteTab = (id: number) => {
      store.dispatch('deleteTab', id)
      if (instance) {
        checkTabsOverflow(store, instance.proxy)
      }
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

<style scoped>
.app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  overflow-x: auto; /* 允许水平滚动 */
  white-space: nowrap; /* 防止元素换行 */
  padding: 5px;
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  gap: 5px;
}

.tab {
  display: flex;
  gap: 5px;
  flex-shrink: 0; /* 防止 tab 在空间不足时被压缩 */
}
</style>