<script setup lang="ts">
import MarkdownEditor from './components/MarkdownEditor_Demo.vue'

components: {
  MarkdownEditor
}
</script>

<template>
  <div class="app">
    <header>
      <!-- 添加 MarkdownEditor 组件 -->
      <MarkdownEditor />
    </header>
  </div>
</template>

<style scoped>
.app {
  height: 100%; /* 将高度改为 100% */
  width: 100%; /* 将宽度改为 100% */
  overflow: hidden; /* 隐藏滚动条 */ 
}
</style>