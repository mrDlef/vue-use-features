<script lang="ts" setup>
import useFeatures from '@/useFeatures';

// Reads whichever registry is in scope, and seeds nothing: now that registries
// are shared, a viewer that registered its own flags on mount would write into
// the host application's registry.
const { enable, disable, isEnabled, all } = useFeatures();
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
      <tr v-for="(flag, i) in all()" :key="`feature-${i}`">
        <td>{{ flag }}</td>
        <td>{{ isEnabled(flag) }}</td>
        <td>
          <template v-if="isEnabled(flag)">
            <button @click="disable(flag)">Disable</button>
          </template>
          <template v-else>
            <button @click="enable(flag)">Enable</button>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
