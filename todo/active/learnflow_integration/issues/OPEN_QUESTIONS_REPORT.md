# OPEN QUESTIONS & AMBIGUITIES REPORT
**Learnflow Avatar Integration**

**Reviewer:** Project Manager
**Date:** 2025-11-27
**Purpose:** Identify decisions needed before implementation

---

## EXECUTIVE SUMMARY

The integration plan has **24 open-ended questions** requiring stakeholder input. Most critical gaps are around:

1. **Learnflow's current architecture** (Socket.IO vs WebSocket)
2. **Deployment and infrastructure** (hosting, CDN, security)
3. **Product decisions** (feature flags, fallbacks, mobile)
4. **External dependencies** (team capacity, backend changes)

---

## CRITICAL QUESTIONS (Must Answer Before Starting)

### 1. WebSocket Architecture Mismatch
**Question:** Does Learnflow use Socket.IO or native WebSocket?

**Priority:** MUST ANSWER BEFORE STARTING

**Context:**
- Plan mentions "Socket.IO events" but creates native `WebSocket()`
- These are incompatible protocols

**Options:**
1. Socket.IO → Use `socket.io-client` library
2. Native WebSocket → Current plan correct, fix docs
3. Mixed → Use both (need dual connections)

**Who Should Answer:** Alex

---

### 2. Backend WebSocket Endpoint Existence
**Question:** Does `/ws/avatar` endpoint already exist?

**Priority:** MUST ANSWER BEFORE STARTING

**Impact:**
- If not exists, need backend tasks (+8-12 hours)

**Who Should Answer:** Alex + Backend Team

---

### 3. Authentication Strategy
**Question:** How does avatar WebSocket handle authentication?

**Priority:** MUST ANSWER BEFORE STARTING

**Options:**
1. JWT in query param: `ws://host/ws/avatar?token=xxx`
2. Session cookie
3. No auth (if backend handles at bot config level)

**Who Should Answer:** Alex + Security Team

---

### 4. Provider Selection Logic
**Question:** How is `azure` vs `gemini-live` chosen?

**Priority:** MUST ANSWER BEFORE STARTING

**Options:**
1. Per-bot fixed config
2. User preference
3. Dynamic fallback
4. Backend decision

**Who Should Answer:** Alex + Product Owner

---

### 5. TalkingHead.js File Hosting
**Question:** Where will `talkinghead.mjs` (~500KB) be hosted?

**Priority:** MUST ANSWER BEFORE TASK 1.2

**Options:**
1. Self-hosted (`/static/`)
2. CDN (CloudFront/Cloudflare)
3. npm package
4. Bundled with Vue app

**Who Should Answer:** Alex + DevOps

---

### 6. Azure Speech SDK API Keys
**Question:** Where are Azure keys stored?

**Priority:** MUST ANSWER BEFORE TASK 3.3

**Options:**
1. Backend proxy (RECOMMENDED)
2. Frontend SDK (security risk)
3. SAS tokens
4. No Azure - Gemini only

**Who Should Answer:** Alex + Security Team

---

### 7. Avatar Model (.glb) Hosting
**Question:** Where are avatar .glb files hosted?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Options:**
1. ReadyPlayer.me direct (rate limits?)
2. Self-hosted
3. CDN
4. Hybrid

**Who Should Answer:** Alex + Infrastructure

---

## DEPLOYMENT & INFRASTRUCTURE

### 8. Environment Configuration
**Question:** How are WebSocket URLs configured across environments?

**Priority:** MUST ANSWER BEFORE PHASE 5

**Options:**
1. Environment variables (`VITE_AVATAR_WS_URL`)
2. Runtime config from API
3. Relative URLs
4. Bot config field

**Who Should Answer:** Alex

---

### 9. Production Deployment Sequence
**Question:** What deployment order? Frontend before backend?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Options:**
1. Backend first
2. Feature flag both
3. Gradual rollout
4. Big bang (risky)

**Who Should Answer:** Alex + DevOps

---

### 10. HTTPS/WSS in Production
**Question:** Will production use WSS (secure WebSocket)?

**Priority:** MUST ANSWER BEFORE PRODUCTION

**Who Should Answer:** DevOps Team

---

## PRODUCT & UX DECISIONS

### 11. Feature Flag Strategy
**Question:** Should avatar be behind a feature flag?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Bot-level flag + global kill switch

**Who Should Answer:** Product Owner + Alex

---

### 12. Fallback Strategy Priority
**Question:** What's the fallback chain? Avatar → Video → Text?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Avatar → Video → Text (best UX)

**Who Should Answer:** Product Owner + UX Designer

---

### 13. Mobile Device Strategy
**Question:** Disable avatar on mobile or lower quality?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Options:**
1. Disable on mobile (safest)
2. Lower quality models
3. Lower render quality
4. User choice
5. Performance detection

**Suggested:** Option 5 + user override

**Who Should Answer:** Product Owner + Mobile Team

---

### 14. Subtitle Display
**Question:** Show text subtitles while avatar speaks?

**Priority:** NICE TO HAVE

**Suggested:** Always show for accessibility

**Who Should Answer:** Product Owner + Accessibility

---

### 15. User Interruption UX
**Question:** How can user interrupt avatar? Button? Click avatar? Voice?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Multiple methods (button + click + voice)

**Who Should Answer:** UX Designer + Product Owner

---

## TECHNICAL AMBIGUITIES

### 16. Vue 3 State Management
**Question:** Does Learnflow use Pinia, Vuex, or Composition API only?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Follow existing Learnflow pattern

**Who Should Answer:** Alex

---

### 17. Audio Context Lifecycle
**Question:** Per-avatar or global singleton AudioContext?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Singleton with cache (already in plan)

---

### 18. Error Boundary Strategy
**Question:** Where should error boundaries be placed?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Around AvatarContainer + global handler

---

### 19. WebSocket Reconnection Limits
**Question:** Unlimited reconnection or capped? What after max failures?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Auto-fallback to video after max attempts

---

### 20. Message Queue Overflow
**Question:** What if backend sends 100+ messages faster than playback?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Suggested:** Clear on user action + cap at 20

---

## TESTING & QUALITY

### 21. Testing Environment
**Question:** Is there a staging environment for testing?

**Priority:** MUST ANSWER BEFORE PHASE 7

**Who Should Answer:** Alex + DevOps

---

### 22. Performance Benchmarks
**Question:** What are acceptable metrics? FPS? Load time?

**Priority:** NICE TO HAVE

**Suggested:**
- FPS: 30+ desktop, 24+ mobile
- Load time: < 5 seconds
- Memory: < 100MB additional

**Who Should Answer:** Product Owner

---

### 23. Browser Compatibility
**Question:** Which browsers must be supported?

**Priority:** CAN DECIDE DURING IMPLEMENTATION

**Minimum Requirements:**
- Chrome 66+
- Firefox 76+
- Safari 14.1+
- Edge 79+

**Who Should Answer:** Product Owner

---

### 24. Accessibility Compliance
**Question:** What accessibility standards? WCAG 2.1 AA?

**Priority:** NICE TO HAVE

**Who Should Answer:** Product Owner + Accessibility Team

---

## EXTERNAL DEPENDENCIES

### 25. Alex's Team Capacity
**Question:** Does team have 17+ hours available?

**Priority:** MUST ANSWER BEFORE STARTING

**Who Should Answer:** Alex

---

### 26. Backend Team Availability
**Question:** When can backend changes be implemented?

**Priority:** MUST ANSWER BEFORE STARTING

**Who Should Answer:** Backend Team Lead

---

## PRIORITY SUMMARY

### Must Answer Before Starting (10 questions)
1. WebSocket vs Socket.IO architecture
2. Backend endpoint existence
3. Authentication strategy
4. Provider selection logic
5. TalkingHead.js hosting
6. Azure API key management
7. Environment configuration
8. Testing environment availability
9. Alex's team capacity
10. Backend team availability

### Must Answer Before Production (1 question)
11. HTTPS/WSS configuration

### Can Decide During Implementation (9 questions)
12-20. Various UX and technical decisions

### Nice to Have (4 questions)
21-24. Analytics, docs, accessibility

---

## RECOMMENDED NEXT STEPS

### Immediate Actions

1. **Stakeholder Meeting** - Alex + Amit + Backend Team
   - Address all 10 "Must Answer" questions
   - Clarify WebSocket architecture
   - Confirm resource availability

2. **Architecture Audit** - Alex
   - Provide Learnflow WebSocket implementation details
   - Confirm state management approach
   - Share environment config patterns

3. **Backend Gap Analysis** - Backend Team
   - Assess if `/ws/avatar` needs implementation
   - Estimate backend work
   - Define deployment sequence

4. **Decision Log** - Amit
   - Document all answers
   - Update implementation plan
   - Create Architecture Decision Record

5. **Pre-Implementation Checklist**
   - [ ] All critical questions answered
   - [ ] Resources allocated
   - [ ] Testing environment ready
   - [ ] Backend dependencies identified
   - [ ] Go/no-go decision made

---

## CONCLUSION

**Recommendation:** Hold **kick-off meeting** with all stakeholders to address the 10 critical questions before writing any code.

**Estimated Time to Resolve Questions:** 2-4 hours of meetings

**Risk if Not Addressed:**
- Implementation delays (rework due to wrong assumptions)
- Architecture mismatch (incompatible protocols)
- Security issues (missing auth)
- Deployment failures (missing infrastructure)
