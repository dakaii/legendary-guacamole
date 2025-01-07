import { createApp } from 'vue';
import App from './App.vue';
import solanaPlugin from './plugins/solana';

const app = createApp(App);

app.use(solanaPlugin);

app.mount('#app');