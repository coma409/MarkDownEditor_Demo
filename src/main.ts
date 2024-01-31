import { createApp } from 'vue'
import App from './App.vue'
import AuxiliaryApp from './components/AuxiliaryWindow_Demo.vue'
import router from './router'
import store from './store'

const useAuxiliaryView = window.location.hash === '#/auxiliary';

const rootComponent = useAuxiliaryView ? AuxiliaryApp : App;

createApp(rootComponent)
  .use(router)
  .use(store)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })