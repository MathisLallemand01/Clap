// Derrière un proxy d'entreprise ou de cloud (HTTPS_PROXY), les appels serveur vers
// TMDB et Google doivent passer par lui : Node ne le fait pas tout seul.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
}
