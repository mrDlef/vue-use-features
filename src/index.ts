import { createApp } from 'vue-demi';
import FeatureFlagsViewer from '@/components/FeatureFlagsViewer.vue';
import useFeatures from '@/useFeatures';

// Playground only: seed the app-wide registry so the viewer has something to
// toggle. Applications register their own flags the same way.
const { enable, disable } = useFeatures();
enable('Flag enabled by default');
disable('Flag disabled by default');

const app = createApp(FeatureFlagsViewer);
app.mount('#app');
