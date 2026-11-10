export const STATS = [
  "snelheid",
  "efficientie",
  "nauwkeurigheid",
  "stabiliteit",
  "flexibiliteit",
] as const;

export const PRIOS = [
  "Locatie",
  "Snacks",
  "Drankjes",
  "Muziek",
  "Activiteit",
] as const;

export const TEAM_LABELS: Record<string, string> = {
  research: "Research agent",
  planning: "Planning agent",
  crm: "CRM agent",
  finance: "Finance agent",
  writing: "Writing agent",
  mail: "Mail agent",
  design: "Design agent",
  quality: "Quality agent",
};

export const HITL_PLUS = ["tevredenheid", "punten", "sneller", "tokens"] as const;
export const HITL_MIN = ["tokens", "pauze", "fouten", "punten"] as const;
export const HITL_MODUS = ["snel", "zorgvuldig", "zuinig", "samenwerken"] as const;

export const DILEMMAS: Record<string, { q: string }> = {
  tokens: { q: "Mijn tokens raken op. Wat doen we?" },
  vega: { q: "Collega's vragen om een vega-optie. Wat doen we?" },
  activiteit: { q: "Er is nog geen activiteit. Wat doen we?" },
  uitval: { q: "Een agent valt uit. Wat doen we?" },
  typfout: { q: "De invite heeft een typfout. Wat doen we?" },
  tijd: { q: "De tijd dringt. Niet alles komt af. Wat doen we?" },
};
