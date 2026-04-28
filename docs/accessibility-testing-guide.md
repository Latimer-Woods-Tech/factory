# Factory Accessibility Testing Guide

**Scope:** Applies to all Factory applications (videoking, admin-studio, etc.)  
**Standards:** WCAG 2.2 Level AA  
**Baseline:** All new code must pass automated testing before merge  

---

## Overview

Accessibility testing happens at three levels:

1. **Automated (CI/CD)** — Every PR, blocks merge on failures
2. **Manual (Weekly)** — Developers test keyboard navigation
3. **Specialist (Biweekly)** — QA or accessibility champion tests with screen readers

---

## Level 1: Automated Testing (CI Gate)

### Setup: Axe DevTools in CI

#### Install Dependencies
```bash
npm install --save-dev @axe-core/react axe-playwright
```

#### Create GitHub Actions Workflow
File: `.github/workflows/accessibility.yml`

```yaml
name: Accessibility Tests

on:
  pull_request:
    branches:
      - main
      - staging
  push:
    branches:
      - main

jobs:
  axe-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - run: npm run build
      
      - name: Run Accessibility Tests
        run: npm run test:a11y
      
      - name: Generate A11y Report
        if: always()
        run: npm run test:a11y -- --report
      
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-report
          path: a11y-report.html
```

#### Add Test Script to package.json
```json
{
  "scripts": {
    "test:a11y": "axe --chrome --wcag2aa --exit-on-error",
    "test:a11y:watch": "axe --chrome --wcag2aa --watch"
  }
}
```

#### Create Axe Configuration
File: `.axerc.json`

```json
{
  "checkerOptions": {
    "standards": ["wcag2aa"]
  },
  "outputs": ["v2"],
  "rules": {
    "enable": ["*"],
    "disable": [
      "color-contrast"
    ]
  }
}
```

### Playwright Integration (E2E Tests)

File: `test/a11y.spec.ts`

```typescript
import { test } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('homepage should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('signup form should not have violations', async ({ page }) => {
    await page.goto('/signup');
    await injectAxe(page);
    await checkA11y(page, 'form', {
      rules: {
        'color-contrast': { enabled: false }, // Known issue in scope
      },
    });
  });

  test('video player should be keyboard navigable', async ({ page }) => {
    await page.goto('/watch/video-123');
    
    // Test keyboard navigation
    await page.press('body', 'Tab');
    const focused = await page.evaluate(() => document.activeElement?.className);
    
    expect(focused).toBeTruthy(); // Something focused
    
    // Run accessibility check
    await injectAxe(page);
    await checkA11y(page, '.video-player');
  });
});
```

### CI Failure Handling

**If Axe reports failures:**

1. **Check Report Artifact** — Download from GitHub Actions
2. **Identify False Positives** — Some issues may not apply (test with team)
3. **Document Exceptions** — Add comments to `.axerc.json`:
   ```json
   {
     "rules": {
       "best-practice": { "enabled": false }, // Custom component handles this
       "color-contrast": { "enabled": false } // Known baseline issue, being remediated
     }
   }
   ```
4. **Do NOT Merge** — Fix the issue or document waiver (requires champion approval)

---

## Level 2: Developer Keyboard Testing (Weekly)

### Weekly Keyboard Navigation Test (30 min)

**Frequency:** Every Friday before code freeze  
**Duration:** 30 minutes  
**Participants:** Developer + 1 peer reviewer (optional)

#### Test Checklist

**Setup:**
- [ ] Close mouse; use only keyboard
- [ ] Disable JavaScript in DevTools (to simulate assistive tech)
- [ ] Open browser DevTools (F12)

**Test Script:**
```bash
# 1. Page Load & Tab Through
Tab → Tab → Tab → ... (entire page)
- All buttons reachable? ✓
- All links reachable? ✓
- All form inputs reachable? ✓
- Focus order logical (left-to-right, top-to-bottom)? ✓

# 2. Focus Visibility
- Every interactive element has visible focus indicator (blue outline)? ✓
- Focus indicator is ≥3px and visible? ✓
- No focus "flash" on mouse click? ✓

# 3. Modal/Dialog Handling (if applicable)
- Open modal (Tab to button, Enter)
- Tab within modal — stays trapped
- Press Esc — modal closes, focus returns to button
- Repeat 3 times — no hang

# 4. Form Submission (if applicable)
- Tab to each form field
- Type test data
- Tab to submit button
- Enter — form submits
- Check error messages appear and announce (even without audio)

# 5. Video Player (if applicable)
- Tab to player
- Space → play/pause
- → (Right arrow) → seek forward
- ← (Left arrow) → seek back
- ↑ (Up) → volume up
- ↓ (Down) → volume down
- f → fullscreen
- Esc → exit fullscreen
```

#### Document Results
File: `.testing/keyboard-test-log.md`

```markdown
# Keyboard Navigation Test — April 29, 2026

## Page: /
- [x] All buttons reachable
- [x] All links reachable
- [x] Focus order logical
- [x] Focus indicators visible
- [x] No traps

**Issues Found:** None  
**Tester:** @alice  
**Duration:** 15 min

---

## Page: /subscribe
- [x] All buttons reachable
- [x] Form inputs reachable
- [x] Modal traps focus ✓
- [x] Esc closes modal ✓
- [x] Error message visible

**Issues Found:** None  
**Tester:** @bob  
**Duration:** 20 min
```

---

## Level 3: Screen Reader Testing (Biweekly)

### Biweekly Screen Reader Test (2 hours)

**Frequency:** Every 2 weeks (2nd & 4th Friday)  
**Duration:** 2 hours  
**Participants:** QA tester + accessibility champion  
**Tools:** NVDA (Windows) or JAWS (trial)

#### Test Checklist

**Setup:**
- [ ] Install NVDA (https://www.nvaccess.org)
- [ ] Start NVDA (Ctrl+Alt+N)
- [ ] Open Firefox (best NVDA support)

**Test Script for videoking home:**
```bash
# NVDA: Insert+Home (read all from top)

Expected output:
✓ "Videoking, heading level 1"
✓ "Navigation, main landmark"
✓ "Browse videos, button"
✓ "Sign up here link"
✓ "Featured video, region"
✓ "Video title: Demo Reel, heading level 2"
✓ "Creator: Jane Smith"
✓ "Watch button"
✓ "Subscribe button"
✓ "Search results, 1 of 10"

# Test: Tab to play button
Expected: "Play button"

# Test: Tab to subscribe
Expected: "Subscribe button" or "Subscribe button, toggle button" (if stateful)
```

#### Common Screen Reader Commands

**NVDA:**
- `Insert + Home` — Read entire page
- `Insert + Down` — Read next line
- `Tab` — Tab to next interactive element (announce role/state)
- `h` — Jump to next heading
- `b` — Jump to next button
- `l` — Jump to next link
- `Ctrl+Home` — Move to page top

**JAWS:**
- `Insert + Home` — Read entire page
- `Insert + Down` — Read next line
- `Tab` — Tab to next interactive element
- `h` — Jump to next heading
- `b` — Jump to next button
- `Insert + F10` — Activities menu (opens element inspector)

#### Document Results

```markdown
# Screen Reader Test — April 26, 2026

## Tool: NVDA + Firefox

### Page: /
**User Test:** Click signup flow
1. NVDA announces "Sign up button"
2. User taps Enter
3. NVDA announces "Signup form, region"
4. User tabs to email field
5. NVDA announces "Email, edit text, required"
6. User types test@example.com
7. User tabs to next field
8. NVDA announces "Name, edit text, required"
✓ All steps announced correctly

### Page: /watch/:id
**User Test:** Watch video
1. User tabs to player
2. NVDA announces "Video player, application"
3. User presses Space (play/pause)
✓ NVDA announces video is now playing
4. User presses Right arrow (seek)
✓ NVDA announces position "Timestamp: 1 minute 25 seconds"

**Issues Found:** None  
**Tester:** @accessibility-champion  
**Duration:** 90 min
```

---

## Level 4: Color Contrast Verification (Per PR)

### Automated Check (Per Commit)
```bash
# Install
npm install --save-dev pa11y

# Run
npm run test:contrast
```

### Manual Verification (Per PR)
**Tool:** Lighthouse (built into Chrome)

```bash
1. Open Chrome DevTools (F12)
2. Click "Lighthouse" tab
3. Click "Generate report"
4. Check "Accessibility" score ≥90
5. Look for "Contrast" issues
6. Run "Contrast Ratio" check via Web AIM (https://webaim.org/resources/contrastchecker/)
```

### Contrast Requirements

| Type | Minimum Ratio | WCAG 2.2 AA |
|------|---------------|-----------|
| Normal Text | 4.5:1 | ✓ |
| Large Text (≥18pt) | 3:1 | ✓ |
| Non-text (UI, graphics) | 3:1 | ✓ |
| **Factory Targets** | 7:1 | ✓ (enhanced) |

---

## CI/CD Integration Checklist

- [ ] `.github/workflows/accessibility.yml` created
- [ ] Axe tests run on every PR
- [ ] Failures block merge
- [ ] Report artifact generated
- [ ] Team notified of new A11y issues
- [ ] Accessibility champion reviews high-priority failures

---

## Training & Onboarding

### Monthly 15-Minute Sync

**Agenda (15 min):**
1. Review recent A11y issues (5 min)
2. Discuss common patterns (5 min)
3. Q&A (5 min)

**Note These in Wiki:**
- Common mistakes: "Buttons without labels", "Color-only indicators", "Keyboard traps"
- Best practices: "Always add aria-label", "No placeholder-only labels", "Test with Tab"
- Resources: Links to WCAG 2.2, WebAIM articles, video tutorials

### Developer Onboarding Checklist

New developers working on Factory apps must:
- [ ] Read this guide
- [ ] Complete 1 keyboard navigation test (supervised)
- [ ] Complete 1 screen reader test (supervised)
- [ ] Review WCAG 2.2 AA quick reference (15 min)
- [ ] Bookmark WebAIM.org for reference

---

## Troubleshooting

### "Axe reports 'color-contrast' but my colors look fine"
**Solution:** Use Web AIM Contrast Ratio tool to verify. If you genuinely disagree with Axe, document the waiver in `.axerc.json` with a comment.

### "My modal won't trap focus with focus-trap-react"
**Checklist:**
- [ ] Modal has `role="dialog"`
- [ ] Modal has `aria-modal="true"`
- [ ] FocusTrap is active (`active={isOpen}`)
- [ ] No overlays or z-index issues

### "Screen reader won't announce my dynamic update"
**Checklist:**
- [ ] Element has `role="alert"` OR parent has `aria-live="polite"`
- [ ] `aria-atomic="true"` (announce entire region)
- [ ] Update DOM directly (not virtual; some frameworks need special handling)

---

## Tools at a Glance

| Tool | Type | Cost | Use Case |
|------|------|------|----------|
| **Axe DevTools** | Automated | Free (browser extension) | CI gate + local testing |
| **NVDA** | Screen Reader | Free | Windows keyboard testing |
| **JAWS** | Screen Reader | $90/month | Advanced Windows testing |
| **Lighthouse** | Automated | Free (Chrome) | Contrast + performance audit |
| **Helperbird** | Browser Ext | Free | Real-time contrast checker |
| **Accessibility Insights** | Browser Ext | Free (Microsoft) | Automated + manual testing |

---

## Appendix: Key WCAG 2.2 AA Criteria (25 Total)

| ID | Criterion | Pass Requirement |
|----|-----------|-----------------|
| 1.1.1 | Non-text Content | All images have alt text |
| 1.4.3 | Contrast | Text ≥4.5:1 (≥3:1 large) |
| 2.1.1 | Keyboard | All features keyboard accessible |
| 2.1.2 | Keyboard (No Trap) | No keyboard trap without escape |
| 2.4.3 | Focus Order | Tab order logical |
| 2.4.7 | Focus Visible | Focus indicator visible |
| 3.3.2 | Form Labels | All inputs have associated labels |
| 4.1.2 | Name, Role, Value | All components have ARIA properties |
| 4.1.3 | Status Messages | Status updates announced |

---

**Last Updated:** April 28, 2026  
**Maintained By:** Accessibility Champion  
**Review Cycle:** Quarterly
