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

export const demoAudioHost = createAudioHost();
