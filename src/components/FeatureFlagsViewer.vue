<script lang="ts" setup>
  import useFeatures from '@/useFeatures';

  const {
    enable,
    disable,
    isEnabled,
    all,
  } = useFeatures();
  enable('Flag enabled by default');
  disable('Flag disabled by default');
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
            <button @click="disable(flag)">
              Disable
            </button>
          </template>
          <template v-else>
            <button @click="enable(flag)">
              Enable
            </button>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>