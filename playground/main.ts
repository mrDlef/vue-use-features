import { createApp } from 'vue-demi';
import FeatureFlagsViewer from './FeatureFlagsViewer.vue';
import useFeatures, { applyQueryFlags, loadFeatures, persistFeatures, vFeature } from '@/index';

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

// Then the asynchronous layer, behind `?remote` so the plain playground stays
// synchronous. The fake backend keeps the two defaults and adds one of its own,
// which is what makes the authoritative replace visible rather than destructive.
// Combine it with `?remote&ff=-Flag+enabled+by+default` to watch a pinned
// override survive a payload that says otherwise.
if (new URLSearchParams(location.search).has('remote')) {
  const fakeBackend = () =>
    new Promise<Record<string, boolean>>((resolve) => {
      setTimeout(
        () =>
          resolve({
            'Flag enabled by default': true,
            'Flag disabled by default': false,
            'Flag from the backend': true
          }),
        800
      );
    });

  const remote = loadFeatures(features, fakeBackend, { pinned: fromUrl });
  console.info('[playground] loading flags from the fake backend…');
  void remote.ready.then(() => {
    console.info('[playground] flags loaded:', features.snapshot());
  });
}

const app = createApp(FeatureFlagsViewer);
app.directive('feature', vFeature);
app.mount('#app');
