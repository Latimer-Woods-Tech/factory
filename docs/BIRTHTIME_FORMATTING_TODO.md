# Birth Time Formatting — Frontend Implementation TODO

**Created**: April 28, 2026  
**Status**: PENDING (Phase 7 - prime-self app)  
**Priority**: Medium  
**Epic**: Prime Self Engine - Astrology/Human Design Chart Input

---

## Problem Statement

When users create birth charts (astrology, human-design, gene-keys, numerology), they must provide:
- Birth date (YYYY-MM-DD)
- **Birth time (HH:MM in 12-hour AM/PM format)**
- Birth location (city)

Current challenge: HTML `<input type="time">` returns 24-hour format (HH:MM), but most astrology/numerology systems are used to entering birth times in 12-hour AM/PM format (e.g., "3:45 PM", "11:30 AM").

---

## User Experience Issue

**Current (Broken)**:
```html
<input type="time" value="15:45" />
<!-- Displays as 15:45 (24-hour format) -->
<!-- User expects to see/enter "3:45 PM" -->
```

**Expected**:
- Display field shows: "3:45 PM" (user-friendly 12-hour)
- Submission to backend converts to: "15:45" (24-hour ISO 8601)
- Database stores: ISO 8601 timestamp

---

## Solution Design

### Frontend Component (`prime-self` app)

**Location**: `apps/prime-self/src/components/BirthTimeInput.tsx`

```typescript
/**
 * BirthTimeInput — Select birth time in 12-hour AM/PM format
 * Converts to 24-hour ISO 8601 for submission
 */
export interface BirthTimeInputProps {
  value: string;  // ISO 8601 24-hour format: "15:45"
  onChange: (iso8601Time: string) => void;  // e.g., "15:45"
  error?: string;
}

export function BirthTimeInput({ value, onChange, error }: BirthTimeInputProps) {
  // Parse ISO value to 12-hour display
  const [hours12, minutes, period] = formatTo12Hour(value);

  function handleChange(newHours12: number, newMinutes: number, newPeriod: 'AM' | 'PM') {
    const iso8601 = convertTo24Hour(newHours12, newMinutes, newPeriod);
    onChange(iso8601);
  }

  return (
    <div className="birth-time-input">
      <div className="time-display">
        <select value={hours12} onChange={(e) => handleChange(parseInt(e.target.value), minutes, period)}>
          {/* 1-12 */}
        </select>
        <span>:</span>
        <select value={minutes} onChange={(e) => handleChange(hours12, parseInt(e.target.value), period)}>
          {/* 00-59 */}
        </select>
        <select value={period} onChange={(e) => handleChange(hours12, minutes, e.target.value as 'AM' | 'PM')}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
```

### Helper Functions

**Location**: `apps/prime-self/src/lib/timeFormatting.ts`

```typescript
/**
 * Convert 24-hour ISO format to 12-hour display
 * @param iso "15:45" → [3, 45, "PM"]
 */
export function formatTo12Hour(iso: string): [number, number, 'AM' | 'PM'] {
  const [hours, minutes] = iso.split(':').map(Number);
  
  if (hours === 0) return [12, minutes, 'AM'];  // 00:45 → 12:45 AM
  if (hours < 12) return [hours, minutes, 'AM'];
  if (hours === 12) return [12, minutes, 'PM'];  // 12:45 PM
  return [hours - 12, minutes, 'PM'];  // 14:45 → 2:45 PM
}

/**
 * Convert 12-hour display to 24-hour ISO format
 * @param hours12 3, minutes 45, period "PM" → "15:45"
 */
export function convertTo24Hour(hours12: number, minutes: number, period: 'AM' | 'PM'): string {
  let hours24 = hours12 % 12;  // 12 AM → 0, 1 AM → 1, etc.
  
  if (period === 'PM' && hours24 !== 0) {
    hours24 += 12;  // 1 PM → 13, 11 PM → 23
  }
  
 return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
```

### Form Integration

**Location**: `apps/prime-self/src/pages/CreateChart.tsx`

```typescript
const [birthTime, setBirthTime] = useState('09:30');  // ISO format

return (
  <form>
    <BirthTimeInput 
      value={birthTime}
      onChange={setBirthTime}
      error={errors.birthTime}
    />
  </form>
);
```

---

## Validation Rules

1. **Hours**: 1–12 (not 0–23)
2. **Minutes**: 0–59
3. **Period**: AM or PM
4. **Combined**: Must produce valid time (no "13:00 PM", etc.)
5. **ISO output**: Always 24-hour format for database

---

## Testing Checklist

- [ ] Unit: `formatTo12Hour("15:45")` → `[3, 45, "PM"]`
- [ ] Unit: `convertTo24Hour(3, 45, "PM")` → `"15:45"`
- [ ] Unit: Edge cases (midnight, noon, 12 AM, 12 PM)
- [ ] Integration: Form submission sends ISO format to backend
- [ ] Integration: Display re-loads saved time in 12-hour format
- [ ] A11y: Keyboard navigation through time selects
- [ ] A11y: Screen reader announces time correctly
- [ ] Mobile: Responsive dropdowns for iPhone

---

## Database Schema (Already Defined)

```sql
-- From write-schema.mjs
CREATE TABLE charts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  chart_type TEXT NOT NULL,  -- astrology | human-design | gene-keys
  chart_data JSONB NOT NULL  -- { birthDate, birthTime (ISO), birthLocation, ... }
);
```

---

## Implementation Phase

**When**: Phase 7 - Prime Self Engine (after prime-self app scaffolding)  
**Effort**: 2–3 hours  
**Dependencies**:
- Prime Self app repo exists
- Design system inputs available
- Backend chart API functional

---

## Related Tasks

- [ ] Create `<BirthDateInput>` for date picker (use native `<input type="date">`)
- [ ] Create `<LocationSearch>` for birth city picker (reverse geocoding)
- [ ] Wire all three into `<ChartCreationForm>`
- [ ] Add tests for 12/24-hour edge cases
- [ ] Document in design system guide

---

## Notes

**Why not use `<input type="time">` directly?**
- Returns 24-hour format (15:45) but users expect 12-hour (3:45 PM)
- No native AM/PM toggle in HTML
- Astrology/Human Design communities standardize on 12-hour notation

**Why not use a time picker library?**
- Adds dependency; Factory prefers minimal, controlled deps
- Three simple dropdowns = accessible + mobile-friendly + testable

**Browser Compatibility**:
- ✅ Chrome, Firefox, Safari, Edge (all modern versions)
- ✅ iOS Safari (dropdown UX is standard)
- ⚠️ IE 11 (not supported in Factory stack)

---

**This is a blocking issue for prime-self app MVP. Do not ship birth chart creation without 12-hour AM/PM support.**
