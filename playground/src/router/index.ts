import { createRouter, createWebHistory } from 'vue-router';
import VariantsEditor from '../views/VariantsEditor.vue';
import SessionSimulator from '../views/SessionSimulator.vue';
import FlowSimulator from '../views/FlowSimulator.vue';
import RulesSimulator from '../views/RulesSimulator.vue';
import DemoView from '../views/DemoView.vue';
import ChatbotSimulator from '../views/ChatbotSimulator.vue';

const routes = [
  {
    path: '/',
    name: 'demo',
    component: DemoView,
    meta: { title: 'Amit Platform Demo - E2E Showcase' }
  },
  {
    path: '/variants',
    name: 'variants',
    component: VariantsEditor,
    meta: { title: 'Variants Editor' }
  },
  {
    path: '/variants-editor',
    redirect: '/variants'
  },
  {
    path: '/session',
    name: 'session',
    component: SessionSimulator,
    meta: { title: 'Session Simulator' }
  },
  {
    path: '/flow',
    name: 'flow',
    component: FlowSimulator,
    meta: { title: 'Flow Simulator' }
  },
  {
    path: '/rules',
    name: 'rules',
    component: RulesSimulator,
    meta: { title: 'Rules Builder' }
  },
  {
    path: '/chatbot',
    name: 'chatbot',
    component: ChatbotSimulator,
    meta: { title: 'Chatbot Simulator' }
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

