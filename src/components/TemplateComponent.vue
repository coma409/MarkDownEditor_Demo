<template>
  <div>
    <!-- Use the 'html' prop as raw HTML -->
    <div v-html="styledHtml"></div>
  </div>
</template>
  
<script lang="ts">
import { computed, defineComponent } from 'vue';
import katexCss from 'katex/dist/katex.min.css?raw';
import prismCss from 'prismjs/themes/prism-solarizedlight.css?raw';

export default defineComponent({
  props: {
    html: String
  },
  setup(props) {
    const styledHtml = computed(() => {
      return `
        <style>${katexCss}</style>
        <style>${prismCss}</style>
        ${props.html}
      `;
    });

    return {
      styledHtml
    };
  }
});
</script>

<style scoped>
</style>  