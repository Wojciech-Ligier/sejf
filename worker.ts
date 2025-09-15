export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}
