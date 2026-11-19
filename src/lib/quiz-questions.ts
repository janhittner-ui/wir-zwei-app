/**
 * Fragen für das Paar-Quiz.
 *
 * So tauschst du sie aus: einfach die Liste unten ändern.
 * - id: kurzer, eindeutiger Name nur aus Kleinbuchstaben, Zahlen und Bindestrichen (max. 40 Zeichen).
 *   Eine id nie für eine andere Frage wiederverwenden, sonst gelten alte Antworten für die neue Frage.
 * - text: die Frage. {partner} wird durch den Namen des Partners ersetzt (der Person, die gerade
 *   NICHT dran ist), {ich} durch den Namen der Person, die dran ist.
 *
 * Vorerst Platzhalter-Fragen, bis die richtigen Fragen da sind.
 */
export interface QuizQuestion {
  id: string;
  text: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 'erstes-date', text: 'Was hat {partner} bei eurem ersten Date getragen?' },
  { id: 'lieblingsessen', text: 'Was ist das Lieblingsessen von {partner}?' },
  { id: 'traumreise', text: 'Wohin würde {partner} am liebsten einmal reisen?' },
  { id: 'superkraft', text: 'Welche Superkraft würde sich {partner} aussuchen?' },
  { id: 'sonntag', text: 'Wie sieht für {partner} ein perfekter Sonntag aus?' },
  { id: 'kindheit', text: 'Was wollte {partner} als Kind einmal werden?' },
  { id: 'lied', text: 'Welches Lied verbindet {partner} mit euch beiden?' },
  { id: 'dankbar', text: 'Wofür bist du {partner} diese Woche dankbar?' },
  { id: 'lachen', text: 'Womit bringt man {partner} garantiert zum Lachen?' },
  { id: 'gebet', text: 'Wofür darfst du heute für {partner} beten?' },
];
