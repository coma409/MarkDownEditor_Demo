import { createRouter, createWebHashHistory } from 'vue-router'

//const staticRoutes = [
//  {
//    path: '/tab1',
//    name: 'Tab1',
//    component: () => import('./components/MarkdownEditor_Test.vue')
//  }
//]

const tabRoutes = [
    {
      path: '/tab:id',
      name: 'Tab',
      component: () => import('./components/MarkdownEditor_Demo.vue'),
      props: route => ({ id: Number(route.params.id) })
    }
]

//const auxiliaryRoutes = [
//  {
//    path: '/auxiliary',
//    name: 'AuxiliaryWindow',
//    component: () => import('./components/AuxiliaryWindow_Demo.vue')
//  }
//];

const router = createRouter({
  history: createWebHashHistory(),
  routes: [ ...tabRoutes]
})

export default router