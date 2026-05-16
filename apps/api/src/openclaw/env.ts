import { homedir } from "node:os";

/** Environment so openclaw CLI works under systemd (user gateway service). */
export function openclawEnv(): NodeJS.ProcessEnv {
  const home = process.env.HOME ?? process.env.CONCIERGE_HOME ?? homedir();
  const uid = process.env.CONCIERGE_UID;
  const npmGlobal = `${home}/.npm-global/bin`;
  const path = [npmGlobal, "/usr/local/bin", "/usr/bin", "/bin"].join(":");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    USER: process.env.CONCIERGE_USER ?? process.env.USER ?? "aperez",
    PATH: path,
    OPENCLAW_BIN: process.env.OPENCLAW_BIN ?? "openclaw",
  };

  if (uid) {
    env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
  }

  return env;
}
