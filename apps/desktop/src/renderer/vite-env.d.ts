/// <reference types="vite/client" />

import type { FdmApi } from '../preload/index.js';

declare global {
  interface Window {
    fdm: FdmApi;
  }
}

