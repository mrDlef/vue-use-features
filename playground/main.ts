import { createApp } from 'vue-demi';
import FeatureFlagsViewer from './FeatureFlagsViewer.vue';
import useFeatures, { applyQueryFlags, persistFeatures } from '@/index';

const features = useFeatures();

// Defaults the application ships with.
features.setFlags({
  'Flag enabled by default': true,
  'Flag disabled by default': false
});

// Then the layers, in the order that makes each one able to win over the
// previous: stored state overrides the defaults, and the URL overrides both.
// Toggle a flag below, reload, and it survives; add `?ff=-a-stored-flag` to
// force one off for a single visit.
persistFeatures(features);
const fromUrl = applyQueryFlags(features);

if (fromUrl.length > 0) {
  console.info('[playground] flags forced from the query string:', fromUrl.join(', '));
}

const app = createApp(FeatureFlagsViewer);
app.mount('#app');
