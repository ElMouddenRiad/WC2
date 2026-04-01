/**
 * Simule une application « hôte » séparée qui possède le AudioContext.
 * La page integration-host-app.html (mode B) importe ce module et ne contient
 * aucun appel à `new AudioContext()`: elle ne fait qu’appeler ensureAudioContext()
 * puis getAudioContext(), comme une intégration tierce (SDK, autre bundle, etc.).
 */

export function createAudioHost() {
  let _ctx = null;
  return {
    async ensureAudioContext() {
      if (!_ctx) {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        await _ctx.resume();
      }
      return _ctx;
    },
    getAudioContext() {
      return _ctx;
    },
  };
}

/** Instance unique pour la démo (équivalent « singleton » du back-office). */
export const demoAudioHost = createAudioHost();
