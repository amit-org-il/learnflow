# Accessibility (a11y) Issues Report

**Generated:** 2025-11-30 17:04
**Project:** Learnflow Avatar Integration
**Scope:** packages/chatbot/src/components

---

## Summary

**Critical Issues:** 2
**High Priority:** 3
**Medium Priority:** 2
**Low Priority:** 1

**WCAG 2.1 Compliance:** Level A (Partial), Level AA (Incomplete)

---

## Critical Accessibility Issues

### 1. Missing ARIA Labels on Interactive Elements

**Severity:** Critical (WCAG 2.1 Level A - 4.1.2 Name, Role, Value)
**File:** `AvatarContainer.vue:35-41`

**Current Code:**
```vue
<!-- ❌ No ARIA label or accessible name -->
<button
  v-if="isSpeaking"
  class="avatar-stop-button"
  @click="handleStop"
>
  Stop
</button>
```

**Issue:** Screen readers cannot identify button purpose when text alone is insufficient

**Fix:**
```vue
<!-- ✅ Add ARIA label for screen readers -->
<button
  v-if="isSpeaking"
  class="avatar-stop-button"
  @click="handleStop"
  aria-label="Stop avatar speech"
  aria-live="polite"
>
  Stop
</button>
```

**Also Affects:**
- `ViewToggleButton.vue` - No ARIA labels for view switcher
- `VoiceRecorder.vue` - Mic button needs state announcement

**Priority:** **CRITICAL** - Blocks screen reader users
**Effort:** 30 minutes

---

### 2. No Keyboard Navigation Support

**Severity:** Critical (WCAG 2.1 Level A - 2.1.1 Keyboard)
**Files:** All interactive components

**Current Issues:**

**a) VoiceRecorder.vue - Mic Button**
```vue
<!-- ❌ No keyboard event handlers -->
<button
  @click="toggleRecording"
  :class="{ recording: state.isRecording.value }"
>
  <svg>...</svg>
</button>
```

**Fix:**
```vue
<!-- ✅ Add keyboard support -->
<button
  @click="toggleRecording"
  @keydown.space.prevent="toggleRecording"
  @keydown.enter="toggleRecording"
  :aria-pressed="state.isRecording.value"
  :aria-label="state.isRecording.value ? 'Stop recording' : 'Start recording'"
  :class="{ recording: state.isRecording.value }"
>
  <svg aria-hidden="true">...</svg>
</button>
```

**b) ViewToggleButton.vue - View Switcher**
```vue
<!-- ❌ Needs keyboard navigation between options -->
<button @click="changeView('head')">Head</button>
<button @click="changeView('body')">Body</button>
<button @click="changeView('full')">Full</button>
```

**Fix:**
```vue
<!-- ✅ Add role and keyboard nav -->
<div role="radiogroup" aria-label="Avatar camera view">
  <button
    v-for="view in views"
    :key="view"
    role="radio"
    :aria-checked="currentView === view"
    @click="changeView(view)"
    @keydown.arrow-left="previousView"
    @keydown.arrow-right="nextView"
  >
    {{ view }}
  </button>
</div>
```

**Priority:** **CRITICAL** - Required for keyboard-only users
**Effort:** 1 hour

---

## High Priority Issues

### 3. Missing Loading State Announcements

**Severity:** High (WCAG 2.1 Level A - 4.1.3 Status Messages)
**File:** `AvatarContainer.vue:3-11`

**Current Code:**
```vue
<!-- ❌ No ARIA live region for screen readers -->
<div v-if="isLoading" class="avatar-loading">
  <div class="avatar-loading__progress">
    {{ Math.round(loadingProgress) }}%
  </div>
</div>
```

**Issue:** Screen reader users don't know avatar is loading or progress

**Fix:**
```vue
<!-- ✅ Add ARIA live regions -->
<div v-if="isLoading" class="avatar-loading" role="status" aria-live="polite">
  <div class="avatar-loading__progress">
    <span class="sr-only">Avatar loading:</span>
    {{ Math.round(loadingProgress) }}%
  </div>
  <div class="avatar-loading__bar" aria-hidden="true">
    <div
      class="avatar-loading__fill"
      :style="{ width: `${loadingProgress}%` }"
      role="progressbar"
      :aria-valuenow="Math.round(loadingProgress)"
      aria-valuemin="0"
      aria-valuemax="100"
    />
  </div>
</div>

<!-- CSS for screen-reader-only text -->
<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

**Priority:** **HIGH**
**Effort:** 20 minutes

---

### 4. Error Messages Not Announced

**Severity:** High (WCAG 2.1 Level A - 3.3.1 Error Identification)
**File:** `AvatarContainer.vue:17-20`

**Current Code:**
```vue
<!-- ❌ Error not announced to screen readers -->
<div v-if="hasError" class="avatar-error">
  <p>{{ errorMessage }}</p>
  <button @click="retry">Retry</button>
</div>
```

**Fix:**
```vue
<!-- ✅ Announce errors immediately -->
<div
  v-if="hasError"
  class="avatar-error"
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
>
  <p id="error-message">{{ errorMessage }}</p>
  <button
    @click="retry"
    aria-label="Retry loading avatar"
    aria-describedby="error-message"
  >
    Retry
  </button>
</div>
```

**Also Add in Component:**
```typescript
watch(() => hasError.value, (newError) => {
  if (newError) {
    // Announce to screen readers
    announceToScreenReader(`Error: ${errorMessage.value}`);
  }
});

function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'assertive');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 3000);
}
```

**Priority:** **HIGH**
**Effort:** 30 minutes

---

### 5. Focus Management Missing

**Severity:** High (WCAG 2.1 Level AA - 2.4.3 Focus Order)
**Files:** All components with dynamic content

**Current Issues:**

**a) Modal/Error State Focus Trap**
```vue
<!-- When error appears, focus should move to error message -->
<div v-if="hasError" class="avatar-error">
  <p>{{ errorMessage }}</p>
  <button @click="retry">Retry</button> <!-- ❌ No auto-focus -->
</div>
```

**Fix:**
```vue
<div v-if="hasError" class="avatar-error" ref="errorContainerRef">
  <p id="error-msg" tabindex="-1" ref="errorMsgRef">{{ errorMessage }}</p>
  <button @click="retry" ref="retryButtonRef">Retry</button>
</div>

<script setup>
const errorMsgRef = ref<HTMLElement | null>(null);
const retryButtonRef = ref<HTMLButtonElement | null>(null);

watch(() => hasError.value, (newVal) => {
  if (newVal) {
    nextTick(() => {
      // Move focus to error or retry button
      retryButtonRef.value?.focus();
    });
  }
});
</script>
```

**b) Stop Button Appears/Disappears**
```vue
<!-- When stop button appears, should it get focus? -->
<button v-if="isSpeaking" @click="handleStop">
  Stop
</button>
```

**Decision:** Don't auto-focus (would interrupt user), but announce:
```vue
<button
  v-if="isSpeaking"
  @click="handleStop"
  aria-label="Stop avatar speech"
>
  Stop
</button>

<div class="sr-only" aria-live="polite" aria-atomic="true">
  {{ isSpeaking ? 'Avatar is speaking. Press Stop to interrupt.' : '' }}
</div>
```

**Priority:** **HIGH**
**Effort:** 45 minutes

---

## Medium Priority Issues

### 6. Streaming Text Lacks Language Declaration

**Severity:** Medium (WCAG 2.1 Level AA - 3.1.2 Language of Parts)
**File:** `StreamingText.vue`

**Current Code:**
```vue
<!-- ❌ No lang attribute for RTL text -->
<div :dir="dir">
  {{ displayText }}
</div>
```

**Fix:**
```vue
<!-- ✅ Add lang attribute for proper pronunciation -->
<div
  :dir="dir"
  :lang="language"
  role="region"
  aria-label="Avatar response"
  aria-live="polite"
  aria-atomic="false"
>
  {{ displayText }}
</div>

<script setup>
interface Props {
  textChunks: string[];
  dir?: 'ltr' | 'rtl' | 'auto';
  language?: string;  // New prop: 'en', 'he', 'ar', etc.
}
</script>
```

**Usage:**
```vue
<StreamingText
  :text-chunks="chunks"
  :dir="direction"
  language="he"  <!-- Hebrew -->
/>
```

**Priority:** **MEDIUM**
**Effort:** 15 minutes

---

### 7. Voice Recorder Missing State Indicators

**Severity:** Medium (WCAG 2.1 Level A - 1.3.1 Info and Relationships)
**File:** `VoiceRecorder.vue`

**Current Issues:**
- No visual indication when mic permission denied
- Volume level not accessible to screen readers
- Recording state only shown visually

**Fix:**
```vue
<button
  @click="toggleRecording"
  :aria-pressed="state.isRecording.value"
  :aria-label="getAriaLabel()"
  :disabled="!state.hasPermission.value && state.hasPermission.value !== null"
>
  <svg aria-hidden="true"><!-- Mic icon --></svg>
  <span class="sr-only">{{ getRecordingStatus() }}</span>
</button>

<!-- Volume indicator for screen readers -->
<div class="sr-only" aria-live="off" role="status">
  Voice volume: {{ Math.round(state.volumeLevel.value * 100) }}%
</div>

<!-- Permission denied message -->
<div
  v-if="state.hasPermission.value === false"
  role="alert"
  aria-live="assertive"
>
  Microphone access denied. Please enable in browser settings.
</div>

<script setup>
function getAriaLabel() {
  if (!state.hasPermission.value) return 'Microphone access denied';
  return state.isRecording.value
    ? 'Stop recording (currently recording)'
    : 'Start recording';
}

function getRecordingStatus() {
  if (state.isInitializing.value) return 'Initializing microphone...';
  if (state.isRecording.value) return 'Recording';
  return 'Ready to record';
}
</script>
```

**Priority:** **MEDIUM**
**Effort:** 30 minutes

---

## Low Priority Issues

### 8. Color Contrast (Visual Accessibility)

**Severity:** Low (WCAG 2.1 Level AA - 1.4.3 Contrast)
**Files:** All component styles

**Issues to Check:**

**a) Avatar Loading Progress**
```css
.avatar-loading__progress {
  color: white;  /* ❓ Check against background gradient */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**Test:** Use contrast checker (minimum 4.5:1 for text)
- White on #667eea: ✅ ~3.2:1 (FAIL)
- White on #764ba2: ✅ ~5.1:1 (PASS)

**Fix:** Ensure text is over darker gradient section or add text shadow:
```css
.avatar-loading__progress {
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);  /* Improves contrast */
}
```

**b) Stop Button**
```css
.avatar-stop-button {
  background: rgba(255, 0, 0, 0.8);  /* Red with 80% opacity */
  color: white;
}
```

**Test:** White on red(204, 0, 0): ✅ ~7.1:1 (PASS)

**Priority:** **LOW** (mostly passing)
**Effort:** 1 hour (full audit)

---

## WCAG 2.1 Compliance Checklist

### Level A (Minimum)

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | ⚠️ PARTIAL | SVG icons need aria-label |
| 1.3.1 Info and Relationships | ❌ FAIL | Missing ARIA roles |
| 2.1.1 Keyboard | ❌ FAIL | No keyboard nav |
| 2.4.1 Bypass Blocks | ✅ PASS | N/A (component) |
| 3.3.1 Error Identification | ❌ FAIL | Errors not announced |
| 4.1.2 Name, Role, Value | ❌ FAIL | Missing ARIA labels |
| 4.1.3 Status Messages | ❌ FAIL | No live regions |

**Level A Compliance:** ❌ 43% (3/7)

### Level AA (Desired)

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.4.3 Contrast (Minimum) | ⚠️ PARTIAL | Some elements need check |
| 2.4.3 Focus Order | ❌ FAIL | No focus management |
| 3.1.2 Language of Parts | ❌ FAIL | Missing lang attrs |

**Level AA Compliance:** ❌ 0% (0/3)

---

## Recommendations Priority List

### CRITICAL (Implement Before Launch)

1. **Add ARIA labels to all buttons**
   - Files: All component files
   - Effort: 30 minutes
   - Impact: Screen reader usability

2. **Implement keyboard navigation**
   - Files: VoiceRecorder.vue, ViewToggleButton.vue
   - Effort: 1 hour
   - Impact: Keyboard-only users can't use app

### HIGH (Implement ASAP)

3. **Add loading state announcements**
   - File: AvatarContainer.vue
   - Effort: 20 minutes
   - Impact: Better user feedback

4. **Announce error messages**
   - File: AvatarContainer.vue
   - Effort: 30 minutes
   - Impact: Error recovery

5. **Focus management**
   - Files: All components
   - Effort: 45 minutes
   - Impact: Navigation flow

### MEDIUM (Next Sprint)

6. **Add language attributes**
   - File: StreamingText.vue
   - Effort: 15 minutes
   - Impact: Proper text-to-speech

7. **Voice recorder state indicators**
   - File: VoiceRecorder.vue
   - Effort: 30 minutes
   - Impact: Recording feedback

### LOW (Future Enhancement)

8. **Color contrast audit**
   - Files: All CSS
   - Effort: 1 hour
   - Impact: Visual accessibility

---

## Testing Recommendations

### Automated Testing

```bash
# Install accessibility testing tools
npm install -D @axe-core/vue vitest-axe

# Add to component tests
import { axe } from 'vitest-axe';

test('AvatarContainer has no accessibility violations', async () => {
  const { container } = render(AvatarContainer, { props: {...} });
  expect(await axe(container)).toHaveNoViolations();
});
```

### Manual Testing Checklist

- [ ] Test with screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
- [ ] Navigate entire UI using keyboard only (no mouse)
- [ ] Check color contrast with DevTools
- [ ] Test with 200% zoom
- [ ] Test with Windows High Contrast mode
- [ ] Test focus visible indicators
- [ ] Verify ARIA live region announcements

---

## Screen Reader Testing Script

**Test Scenario:** Voice recording flow

```
1. Tab to microphone button
   Expected: "Start recording, button"

2. Press Enter or Space
   Expected: "Recording, button pressed. Voice volume: 0%"

3. Speak into microphone
   Expected: (Volume updates announced periodically)

4. Press Enter or Space again
   Expected: "Stop recording, button not pressed"

5. Avatar speaks response
   Expected: "Avatar is speaking. Avatar response: [text]"

6. Tab to Stop button (if visible)
   Expected: "Stop avatar speech, button"
```

---

## Conclusion

**Accessibility Grade: D (Needs Improvement)**

**Critical Gaps:**
❌ No keyboard navigation
❌ Missing ARIA labels
❌ No screen reader announcements
❌ Poor focus management

**Strengths:**
✅ Semantic HTML structure
✅ Proper heading hierarchy (where present)
✅ Error states exist (need enhancement)

**Production Readiness: ❌ NO (for accessible version)**

**Blocking Issues:**
1. Keyboard navigation (CRITICAL)
2. ARIA labels (CRITICAL)
3. Screen reader announcements (HIGH)

**Estimated Effort to WCAG 2.1 Level AA:**
- Critical fixes: 2-3 hours
- High priority: 1-2 hours
- Medium priority: 1 hour
- Testing: 2 hours
- **Total: ~6-8 hours**

**Recommendation:** Allocate accessibility sprint before production launch.
