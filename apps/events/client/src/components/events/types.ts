/** Mirrors the server's Event (Dates serialized to ISO strings over JSON). */
export interface EventItem {
  uid: string
  summary: string
  description: string | null
  startsAt: string
  endsAt: string | null
  location: string | null
  geo: string | null
  organizerName: string | null
  organizerEmail: string | null
  lumaUrl: string | null
  status: string | null
  source: string
}

/** Shared data/callbacks passed from the EventsApp layout to each screen route. */
export interface EventsOutletContext {
  events: EventItem[]
  onOpen: (uid: string) => void
}
