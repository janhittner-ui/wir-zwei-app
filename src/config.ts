/** App-Name an einer Stelle, damit er sich leicht ändern lässt (zusätzlich in app.json → "name"). */
export const APP_NAME = 'Paarweise';
/** Für das Schriftzug-Logo: erster Teil blau, zweiter Teil rosa. */
export const APP_NAME_PARTS = ['Paar', 'weise'] as const;

/**
 * Rechtstexte im Netz (GitHub Pages aus dem öffentlichen Repo janhittner-ui.github.io, Quelle: Ordner website/).
 * Bei eigener Domain nur LEGAL_BASE ändern.
 */
export const LEGAL_BASE = 'https://janhittner-ui.github.io';
export const PRIVACY_URL = `${LEGAL_BASE}/datenschutz.html`;
export const IMPRINT_URL = `${LEGAL_BASE}/impressum.html`;
