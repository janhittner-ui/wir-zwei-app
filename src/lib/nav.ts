/**
 * Zu einem Bereich springen, egal ob er gerade ein Tab ist oder in „Anpassen“ aus der Tab-Leiste
 * genommen wurde (dann öffnet er sich als eigene Seite mit „Zurück“).
 */
import { router } from 'expo-router';

import { isTab, type Area } from './prefs';

export function areaHref(area: Area, params: Record<string, string> = {}) {
  return isTab(area)
    ? { pathname: `/${area}`, params }
    : { pathname: '/bereich/[key]', params: { ...params, key: area } };
}

export function goArea(area: Area, params?: Record<string, string>, how: 'navigate' | 'push' | 'replace' | 'dismissTo' = 'navigate') {
  const href = areaHref(area, params);
  if (how === 'replace') router.replace(href);
  else if (how === 'dismissTo') router.dismissTo(href);
  else if (how === 'push' || !isTab(area)) router.push(href);
  else router.navigate(href);
}
