/**
 * BirthTimeInput Component
 * 
 * Allows users to select birth time in 12-hour AM/PM format,
 * automatically converting to/from 24-hour ISO 8601 format for backend storage.
 * 
 * @example
 * ```tsx
 * const [birthTime, setBirthTime] = useState('09:30');
 * 
 * return (
 *   <BirthTimeInput 
 *     value={birthTime}
 *     onChange={setBirthTime}
 *     error={errors.birthTime}
 *   />
 * );
 * ```
 */

import React, { useMemo } from 'react';
import { formatTo12Hour, convertTo24Hour } from '../lib/timeFormatting';

export interface BirthTimeInputProps {
  /** ISO 8601 24-hour format (e.g., "15:45") */
  value: string;
  
  /** Callback receives ISO 8601 24-hour format */
  onChange: (iso8601Time: string) => void;
  
  /** Optional error message */
  error?: string;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * BirthTimeInput component
 * 
 * Renders three dropdowns for hours (1-12), minutes (00-59), and AM/PM period.
 * Converts between 12-hour display format and 24-hour ISO 8601 storage format.
 */
export function BirthTimeInput({
  value,
  onChange,
  error,
  className = '',
}: BirthTimeInputProps): JSX.Element {
  // Parse ISO 24-hour format into 12-hour display
  const [hours12, minutes, period] = useMemo(
    () => formatTo12Hour(value),
    [value]
  );

  // Generate hours dropdown options (1-12)
  const hoursOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // Generate minutes dropdown options (00-59, increment by 1)
  const minutesOptions = Array.from({ length: 60 }, (_, i) => i);

  // Handle hour change
  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHours12 = parseInt(e.target.value, 10);
    const iso8601 = convertTo24Hour(newHours12, minutes, period);
    onChange(iso8601);
  };

  // Handle minute change
  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinutes = parseInt(e.target.value, 10);
    const iso8601 = convertTo24Hour(hours12, newMinutes, period);
    onChange(iso8601);
  };

  // Handle period (AM/PM) change
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as 'AM' | 'PM';
    const iso8601 = convertTo24Hour(hours12, minutes, newPeriod);
    onChange(iso8601);
  };

  return (
    <div className={`birth-time-input ${className}`.trim()}>
      <fieldset>
        <legend className="sr-only">Birth time (12-hour format)</legend>
        
        <div className="time-display">
          {/* Hours dropdown (1-12) */}
          <select
            value={hours12}
            onChange={handleHourChange}
            aria-label="Hour (1-12)"
            className="time-input__hour"
          >
            {hoursOptions.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, '0')}
              </option>
            ))}
          </select>

          {/* Separator */}
          <span className="time-display__separator" aria-hidden="true">
            :
          </span>

          {/* Minutes dropdown (00-59) */}
          <select
            value={minutes}
            onChange={handleMinuteChange}
            aria-label="Minutes (00-59)"
            className="time-input__minute"
          >
            {minutesOptions.map((minute) => (
              <option key={minute} value={minute}>
                {String(minute).padStart(2, '0')}
              </option>
            ))}
          </select>

          {/* Period dropdown (AM/PM) */}
          <select
            value={period}
            onChange={handlePeriodChange}
            aria-label="AM or PM"
            className="time-input__period"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>

        {/* Error message */}
        {error && (
          <p className="birth-time-input__error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    </div>
  );
}

export default BirthTimeInput;
