/**
 * Minimal ambient types for `ical-expander` (ships no types of its own).
 * The expanded ical.js Event/occurrence objects are typed loosely as `any`.
 */
declare module 'ical-expander' {
  interface IcalExpanderOptions {
    ics: string
    maxIterations?: number
    skipInvalidDates?: boolean
  }

  interface BetweenResult {
    /** Non-recurring ical.js Event instances in range. */
    events: any[]
    /** Expanded recurring occurrences: `{ recurrenceId, item, startDate, endDate }`. */
    occurrences: any[]
  }

  export default class IcalExpander {
    constructor(options: IcalExpanderOptions)
    between(after?: Date, before?: Date): BetweenResult
    before(before: Date): BetweenResult
    after(after: Date): BetweenResult
    all(): BetweenResult
  }
}
