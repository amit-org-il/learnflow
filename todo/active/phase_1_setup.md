# Phase 1: Setup & Dependencies

**Estimated Time:** 2 hours
**Prerequisites:** Node.js >= 18.0.0, Learnflow chatbot package exists

---

## Tasks

- [x] **1.0** Verify prerequisites
- [x] **1.1** Install NPM packages
- [x] **1.2** Copy TalkingHead.js files
- [x] **1.2.5** Create environment variables (.env file)
- [x] **1.3** Configure Vite for .mjs files
- [x] **1.4** Verify setup

---

## Task 1.0: Verify Prerequisites

Before starting, confirm:

```bash
# Check Node.js version (must be >= 18.0.0)
node --version

# Check Learnflow chatbot package exists
ls learnflow/packages/chatbot/package.json

# Check backend is accessible (optional, for testing)
curl http://localhost:8001/health
```

**Browser Requirements:**
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- WebGL 2.0 support required (for Three.js)
- ES modules support required

---

## Task 1.1: Install NPM Packages

**File:** `learnflow/packages/chatbot/package.json`

```bash
cd learnflow/packages/chatbot

# Install Azure Speech SDK (lock version!)
npm install microsoft-cognitiveservices-speech-sdk@1.35.0

# Install Three.js (required by TalkingHead.js)
npm install three@0.160.0
npm install --save-dev @types/three
```

**Why specific versions:**
- `@1.35.0` - Tested version from lipsync-e2e-react
- `three@0.160.0` - Compatible with TalkingHead.js

**Verification:**
```bash
npm list microsoft-cognitiveservices-speech-sdk three
```

---

## Task 1.2: Copy TalkingHead.js Files

**Source:** `lipsync-e2e-react/backend-old/static/modules/`
**Target:** `learnflow/packages/chatbot/public/lib/talkinghead/`

> **IMPORTANT:** Copy to `public/` folder, NOT `src/`. These are runtime-loaded ES modules that should not be bundled by Vite.

**Files to copy:**
```
talkinghead.mjs         (main avatar engine - ~500KB)
lipsync-en.mjs          (English lip-sync rules - required)
dynamicbones.mjs        (physics for hair/clothing - optional but recommended)
```

**Copy command:**
```bash
# Create target directory
mkdir -p learnflow/packages/chatbot/public/lib/talkinghead

# Copy files
cp lipsync-e2e-react/backend-old/static/modules/talkinghead.mjs \
   learnflow/packages/chatbot/public/lib/talkinghead/

cp lipsync-e2e-react/backend-old/static/modules/lipsync-en.mjs \
   learnflow/packages/chatbot/public/lib/talkinghead/

cp lipsync-e2e-react/backend-old/static/modules/dynamicbones.mjs \
   learnflow/packages/chatbot/public/lib/talkinghead/
```

**File size verification:**
```bash
ls -la learnflow/packages/chatbot/public/lib/talkinghead/
# talkinghead.mjs should be ~500KB
# lipsync-en.mjs should be ~50KB
# dynamicbones.mjs should be ~30KB
```

---

## Task 1.2.5: Create Environment Variables

**File:** `learnflow/packages/chatbot/.env`

Create a `.env` file in the chatbot package root to configure backend connection:

```bash
# Create .env file for Vite environment variables
cat > learnflow/packages/chatbot/.env << 'EOF'
# Backend configuration
VITE_BACKEND_PORT=8001
VITE_BACKEND_URL=http://localhost:8001
EOF
```

**Environment Variables:**

| Variable | Purpose | Default | Used In |
|----------|---------|---------|---------|
| `VITE_BACKEND_PORT` | Backend server port number | `8001` | Azure TTS proxy URL, Socket.IO connection |
| `VITE_BACKEND_URL` | Full backend URL (protocol + host + port) | `http://localhost:8001` | API service configuration |

**Usage in code:**
```typescript
// In composables/useAzureTTS.ts
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '8001';
const wsUrl = `wss://${window.location.hostname}:${BACKEND_PORT}/ws/tts/cognitiveservices/websocket/v1`;

// In config/api.ts
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';
}
```

> **Note:** Add `.env` to `.gitignore` if it contains sensitive values. For development, these defaults are safe to commit.

---

## Task 1.3: Configure Vite for .mjs Files

**File:** `learnflow/packages/chatbot/vite.config.ts`

Add configuration to handle external ES modules:

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Allow importing .mjs files from public folder
  optimizeDeps: {
    exclude: ['talkinghead.mjs', 'lipsync-en.mjs', 'dynamicbones.mjs'],
  },
  build: {
    // Don't bundle these - they're loaded at runtime
    rollupOptions: {
      external: ['/lib/talkinghead/talkinghead.mjs'],
    },
  },
});
```

**Loading TalkingHead in Vue:**

```typescript
// In a Vue composable or component
async function loadTalkingHead() {
  try {
    // Load from public folder (NOT from src/)
    const module = await import('/lib/talkinghead/talkinghead.mjs');
    const TalkingHead = module.TalkingHead;
    return TalkingHead;
  } catch (error) {
    console.error('Failed to load TalkingHead:', error);
    throw new Error('Avatar engine failed to load. Please refresh the page.');
  }
}
```

**Why this approach:**
- `.mjs` files are ES modules that may have dynamic imports internally
- Vite bundling can break Three.js imports in talkinghead.mjs
- Loading from `public/` ensures files are served as-is
- Dynamic import with error handling for graceful degradation

---

## Task 1.4: Verify Setup

### 1.4.1 Build Test
```bash
cd learnflow/packages/chatbot
npm run build
```

**Expected:** Build completes without errors.

### 1.4.2 Runtime Test

Create a test file `src/test-talkinghead.ts`:

```typescript
// Temporary test file - delete after verification
export async function testTalkingHeadLoad() {
  console.log('[Test] Starting TalkingHead load test...');

  try {
    // Test 1: Dynamic import
    const module = await import('/lib/talkinghead/talkinghead.mjs');
    console.log('[Test] Module loaded:', Object.keys(module));

    // Test 2: Check TalkingHead class exists
    if (!module.TalkingHead) {
      throw new Error('TalkingHead class not found in module');
    }
    console.log('[Test] TalkingHead class found');

    // Test 3: Check Three.js is available
    const THREE = await import('three');
    console.log('[Test] Three.js version:', THREE.REVISION);

    // Test 4: WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    console.log('[Test] WebGL supported');

    console.log('[Test] All checks passed!');
    return true;
  } catch (error) {
    console.error('[Test] Failed:', error);
    return false;
  }
}
```

Run in browser console or call from a component.

### 1.4.3 Verification Checklist

```
[ ] npm install completed without errors
[ ] npm run build completes without errors
[ ] talkinghead.mjs exists in public/lib/talkinghead/ (~500KB)
[ ] lipsync-en.mjs exists in public/lib/talkinghead/ (~50KB)
[ ] dynamicbones.mjs exists in public/lib/talkinghead/ (~30KB)
[ ] Dynamic import works: await import('/lib/talkinghead/talkinghead.mjs')
[ ] Three.js imports successfully
[ ] WebGL is available in target browsers
[ ] No TypeScript errors in IDE
```

---

## Troubleshooting

### Error: "Failed to resolve module specifier 'three'"

TalkingHead.js expects Three.js. Ensure it's installed:
```bash
npm install three@0.160.0
```

### Error: "WebGL not supported"

User's browser doesn't support WebGL. Add a fallback:
```typescript
if (!navigator.gpu && !document.createElement('canvas').getContext('webgl2')) {
  // Show text-only fallback UI
  showFallbackMode();
}
```

### Error: "CORS policy blocked"

If loading from different origin, ensure backend serves with CORS headers:
```
Access-Control-Allow-Origin: *
```

### Large bundle size warning

This is expected. TalkingHead + Three.js adds ~1-2MB to the bundle.
Consider lazy loading the avatar feature:
```typescript
// Only load when user opens chat with avatar bot
const AvatarContainer = defineAsyncComponent(() =>
  import('./components/AvatarContainer.vue')
);
```

---

## Rollback Plan

If Phase 1 fails and you need to revert:

```bash
cd learnflow/packages/chatbot

# Remove installed packages
npm uninstall microsoft-cognitiveservices-speech-sdk three

# Remove copied files
rm -rf public/lib/talkinghead/

# Restore package files
git checkout package.json package-lock.json

# Restore vite config
git checkout vite.config.ts
```

---

## Next Phase

→ [Phase 2: TypeScript Types](./phase_2_types.md)
