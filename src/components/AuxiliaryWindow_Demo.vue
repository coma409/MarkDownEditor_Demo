<template>
  <div v-if="showFindDialog || showReplaceDialog" class="auxiliary-window">
    <!-- 可拖动的标题栏区域 -->
    <div class="drag-region"></div>
    
    <!-- 查找对话框内容 -->
    <div v-if="showFindDialog" class="dialog-content">
      <div class="dialog-row">
        <input type="text" v-model="findText" placeholder="Find text">
        <label>
          <input type="checkbox" v-model="useRegex">Regex
        </label>
      </div>
      <div class="dialog-row">
        <button @click="findNext">Next</button>
        <button @click="findPrevious">Previous</button>
        <span v-if="matches > 0">[{{ matchIndex }}/{{ matches }}]</span>
      </div>
    </div>

    <!-- 替换对话框内容 -->
    <div v-if="showReplaceDialog" class="dialog-content">
      <div class="dialog-row">
        <input type="text" v-model="findText" placeholder="Find text">
      </div>
      <div class="dialog-row">
        <button @click="findReplaceNext">Next</button>
        <button @click="findReplacePrevious">Previous</button>
        <span v-if="matches > 0">[{{ matchIndex }}/{{ matches }}]</span>
      </div>
      <div class="dialog-row">
        <input type="text" v-model="replaceText" placeholder="Replace with">
      </div>
      <div class="dialog-row">
        <label>
          <input type="checkbox" v-model="useRegex"> Regex
        </label>
        <button @click="replaceTextInEditor">Replace</button>
        <label>
          <input type="checkbox" v-model="replaceAll">All
        </label>
      </div>
    </div>

    <!-- 关闭按钮 -->
    <button class="close-button" @click="closeFindReplaceDialog">X</button>
  </div>
</template>

<script lang="ts">
import { defineComponent,ref, onMounted, onBeforeUnmount } from 'vue';

declare global {
interface Window {
    electron: {
      ipcRenderer: Electron.IpcRenderer;
    };
  }
}

const ipcRenderer = window.electron.ipcRenderer

export default defineComponent({
    setup() {
    const showFindDialog = ref(false);
    const showReplaceDialog = ref(false);
    const findText = ref('');
    const replaceText = ref('');
    const useRegex = ref(false);
    const replaceAll = ref(false);
    const matchIndex = ref(0);
    const matches = ref(0);

    function findNext() {
      ipcRenderer.send('find-in-editor', {
        text: findText.value,
        direction: 'forward',
        useRegex: useRegex.value
      });
    }

    function findPrevious() {
      ipcRenderer.send('find-in-editor', {
        text: findText.value,
        direction: 'backward',
        useRegex: useRegex.value
      });
    }

    function findReplaceNext() {
      ipcRenderer.send('find-replace-text-in-editor', {
        findText: findText.value,
        direction: 'forward',
        useRegex: useRegex.value
      });
    }

    function findReplacePrevious() {
      ipcRenderer.send('find-replace-text-in-editor', {
        findText: findText.value,
        direction: 'backward',
        useRegex: useRegex.value
      });
    }

    function replaceTextInEditor() {
      ipcRenderer.send('replace-in-editor', {
        findText: findText.value,
        replaceText: replaceText.value,
        useRegex: useRegex.value,
        replaceAll: replaceAll.value
      });
    }

    function closeFindReplaceDialog() {
      showFindDialog.value = false;
      showReplaceDialog.value = false;
      ipcRenderer.send('close-auxiliary-window');
    }

    onMounted(() => {
      ipcRenderer.on('show-find-dialog', () => {
        showFindDialog.value = true;
        showReplaceDialog.value = false;
      });

      ipcRenderer.on('display-match-result', (_event, { currentMatchIndex, totalMatches }) => {
        matchIndex.value = currentMatchIndex;
        matches.value = totalMatches;
      });
  
      ipcRenderer.on('show-replace-dialog', () => {
        showFindDialog.value = false;
        showReplaceDialog.value = true;
      });
    })

    onBeforeUnmount(() => {
      ipcRenderer.removeAllListeners('show-find-dialog');
      ipcRenderer.removeAllListeners('display-match-result');
      ipcRenderer.removeAllListeners('show-replace-dialog');
    });

    return {
      showFindDialog,
      showReplaceDialog,
      findText,
      replaceText,
      useRegex,
      replaceAll,
      findNext,
      findPrevious,
      findReplaceNext,
      findReplacePrevious,
      replaceTextInEditor,
      closeFindReplaceDialog,
      matchIndex,
      matches
    };
  }
});
</script>

<style scoped>
.auxiliary-window {
  padding: 25px;
  display: flex;
  flex-direction: column;
  position: absolute; /* 确保按钮可以正确定位 */
  top: 1px; /* 与父元素顶部对齐 */
  left: 1px; /* 与父元素左边对齐 */
  right: 1px; /* 与父元素右边对齐 */
  bottom: 1px; /* 与父元素底部对齐，这样就覆盖了整个父元素 */
}

.drag-region {
  -webkit-app-region: drag;
  position: absolute; /* 绝对定位于父元素内 */
  top: 0; /* 与父元素顶部对齐 */
  left: 0; /* 与父元素左边对齐 */
  right: 0; /* 与父元素右边对齐 */
  bottom: 0; /* 与父元素底部对齐，这样就覆盖了整个父元素 */
  background-color: #f6f6f6; /* 明亮的背景色以提高可识别性 */
  border: 1px solid #000000; /* 添加边框 */
  z-index: 1; /* 确保拖动区域在顶层但低于其他控件 */
  color: white; /* 标题文字颜色 */
  text-align: center; /* 文字居中对齐 */
  line-height: 20px; /* 调整行高以垂直居中文本 */
}

.dialog-content {
  -webkit-app-region: no-drag;
  /* 对话框内容的样式 */
  z-index: 2; /* 高于拖动区域的 z-index */
}

.close-button {
  -webkit-app-region: no-drag;
  position: absolute;
  top: 2px; /* 调整为实际需要的位置 */
  right: 2px; /* 调整为实际需要的位置 */
  z-index: 3; /* 确保按钮在最上层 */
  /* 定义关闭按钮的样式 */
}

.dialog-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.dialog-row:last-child {
  margin-bottom: 0;
}

.dialog-row input[type="text"] {
  flex-grow: 1;
  margin-right: 10px;
}

.dialog-row button {
  margin-right: 10px;
}

/* If you want the last button to not have margin */
.dialog-row button:last-child {
  margin-right: 0;
}

.dialog-row label {
  display: flex;
  align-items: center;
  margin-right: 10px; /* 保持与按钮相同的间距 */
}
</style>