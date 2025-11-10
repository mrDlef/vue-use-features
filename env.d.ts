/// <reference types="vite/client" />

// TypeScript shim for importing .vue files
declare module '*.vue' {
  import type { Component } from 'vue'
  const component: Component
  export default component
}
