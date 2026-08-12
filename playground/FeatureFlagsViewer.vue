<script lang="ts" setup>
import useFeatures from '@/useFeatures';

// Reads whichever registry is in scope, and seeds nothing: now that registries
// are shared, a viewer that registered its own flags on mount would write into
// the host application's registry.
const { toggle, isEnabled, all } = useFeatures();
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>Feature</th>
        <th>Is Enabled</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="flag in all()" :key="flag">
        <td>{{ flag }}</td>
        <td>{{ isEnabled(flag) }}</td>
        <td>
          <button @click="toggle(flag)">{{ isEnabled(flag) ? 'Disable' : 'Enable' }}</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
