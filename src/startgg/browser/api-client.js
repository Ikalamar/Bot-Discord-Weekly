// Appels REST start.gg authentifies via la session sauvegardee, sans lancer de
// navigateur : on reconstruit l'en-tete Cookie depuis le storageState.

import { readFile } from 'node:fs/promises';
import { STATE_FILE, API_HEADERS } from './config.js';

const BASE = 'https://www.start.gg';

async function cookieHeader() {
  const state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  return state.cookies
    .filter((c) => c.domain.includes('start.gg'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/** GET authentifie sur un chemin REST start.gg, ex: '/api/-/rest/...'. */
export async function apiGet(path) {
  const res = await fetch(BASE + path, {
    headers: { ...API_HEADERS, Cookie: await cookieHeader() },
  });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
}
