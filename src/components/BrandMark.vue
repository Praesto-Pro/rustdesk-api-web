<template>
  <span class="brand-mark" :class="{ 'brand-mark--compact': compact }">
    <img :src="mark" width="34" height="34" alt="" />
    <span v-if="!compact" class="brand-mark__wordmark"><strong>Praesto</strong><span>Remote Control</span></span>
    <span v-else class="sr-only">Praesto Remote Control</span>
  </span>
</template>

<script setup>
import mark from '@/assets/praesto-mark.svg'
defineProps({ compact: Boolean })
</script>

<style scoped>
.brand-mark { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--prc-text); }
.brand-mark img { flex: none; }
.brand-mark__wordmark { display: flex; flex-direction: column; gap: 2px; white-space: nowrap; }
.brand-mark__wordmark strong { font-size: 19px; font-weight: 650; letter-spacing: -.5px; line-height: 1.1; }
.brand-mark__wordmark > span { color: var(--prc-muted); font-size: 12px; line-height: 1.3; }
</style>
