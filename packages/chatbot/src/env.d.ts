/// <reference types="vite/client" />
/// <reference path="./types/talking-head.d.ts" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_PORT?: string;
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
