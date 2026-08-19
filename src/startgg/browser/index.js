// Point d'entree de la lib navigateur start.gg.
//
//   import { StartGG } from './browser/index.js';
//   const gg = new StartGG({ email, password });
//   const t = await gg.createTournament({ name, primaryContact, startAt, endAt, srcTournamentId });
//   await gg.publishTournament(t.id);
//   await gg.close();
//
// Pourquoi un navigateur plutot que de simples requetes HTTP : le login et la
// creation de tournoi exigent un token reCAPTCHA v3 a usage unique que seule
// la page peut generer.

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { STATE_FILE, CONTEXT_OPTS, CREATE_PAGE } from './config.js';
import { performLogin } from './login.js';
import { createTournamentOnPage, SourceTournamentNotFoundError } from './create-tournament.js';
import { publishTournament } from './publish-tournament.js';

export { SourceTournamentNotFoundError };

export class StartGG {
  /**
   * @param {Object} opts
   * @param {string} opts.email
   * @param {string} opts.password
   * @param {boolean} [opts.headless=true]
   * @param {string} [opts.sessionFile]  Ou persister/reutiliser la session.
   */
  constructor({ email, password, headless = true, sessionFile = STATE_FILE } = {}) {
    if (!email || !password) throw new Error('email and password are required.');
    this.email = email;
    this.password = password;
    this.headless = headless;
    this.sessionFile = sessionFile;

    this._browser = null;
    this._context = null;
    this._page = null;
    this.user = null;
  }

  /**
   * Garantit une session authentifiee. Reutilise la session sauvegardee tant
   * qu'elle est valide, sinon se reconnecte et l'enregistre.
   * @param {{ force?: boolean }} [opts]
   */
  async login({ force = false } = {}) {
    this._browser = await chromium.launch({ headless: this.headless });

    if (!force && existsSync(this.sessionFile)) {
      this._context = await this._browser.newContext({
        ...CONTEXT_OPTS,
        storageState: this.sessionFile,
      });
      this._page = await this._context.newPage();
      await this._page.goto(CREATE_PAGE, { waitUntil: 'networkidle' });
      if (!this._page.url().includes('/login')) {
        return this; // session encore valide
      }
      await this._context.close();
    }

    this._context = await this._browser.newContext(CONTEXT_OPTS);
    this._page = await this._context.newPage();
    this.user = await performLogin(this._page, { email: this.email, password: this.password });
    await this._context.storageState({ path: this.sessionFile });
    return this;
  }

  /**
   * Cree un tournoi. Passer `srcTournamentId` pour cloner un tournoi existant.
   * @returns {Promise<{ id: number|null, slug: string|null, name: string }>}
   */
  async createTournament(params) {
    if (!this._page) await this.login();
    if (!this._page.url().startsWith(CREATE_PAGE)) {
      await this._page.goto(CREATE_PAGE, { waitUntil: 'networkidle' });
    }
    if (this._page.url().includes('/login')) {
      await this.login({ force: true });
      await this._page.goto(CREATE_PAGE, { waitUntil: 'networkidle' });
    }
    return createTournamentOnPage(this._page, params);
  }

  /**
   * Publie Homepage/Registration/Attendees/Events, et rend le tournoi
   * decouvrable dans la recherche start.gg (true par defaut).
   * @returns {Promise<Object>} resultat par section { ok, data|error }
   */
  async publishTournament(tournamentId, opts) {
    if (!this._page) await this.login();
    return publishTournament(this._page, tournamentId, opts);
  }

  async close() {
    if (this._browser) await this._browser.close();
    this._browser = this._context = this._page = null;
  }
}
