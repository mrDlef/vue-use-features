import { createApp } from 'vue-demi';
import FeatureFlagsViewer from './FeatureFlagsViewer.vue';
import useFeatures from '@/useFeatures';

// Seed the app-wide registry so the viewer has something to toggle.
// Applications register their own flags the same way.
useFeatures().setFlags({
  'Flag enabled by default': true,
  'Flag disabled by default': false
});

const app = createApp(FeatureFlagsViewer);
app.mount('#app');
