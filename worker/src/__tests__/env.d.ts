// Renamed on import: inside the Cloudflare namespace, `Env` is Cloudflare.Env itself.
import type { Env as WorkerEnv } from '../types.js';

declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends WorkerEnv {}
  }
}
