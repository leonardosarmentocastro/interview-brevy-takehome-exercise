import { execFileSync } from "node:child_process";
import { readlinkSync } from "node:fs";
import net from "node:net";

const canBind = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port);
  });

const findPidOnPort = (port: number): number | undefined => {
  try {
    const out = execFileSync(
      "lsof",
      [`-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const pid = Number(out.split("\n")[0]);
    return Number.isFinite(pid) && pid > 0 ? pid : undefined;
  } catch {
    // lsof missing or nothing listening — fall through
  }

  try {
    const out = execFileSync("ss", ["-tlnp", `sport = :${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = out.match(/pid=(\d+)/);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
};

const processCwd = (pid: number): string | undefined => {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return undefined;
  }
};

export const reportPortInUse = (port: number): never => {
  const pid = findPidOnPort(port);
  const dir = pid !== undefined ? processCwd(pid) : undefined;

  console.error(`⨯ Port ${port} is already in use.\n`);
  console.error(`- Local:        http://localhost:${port}`);
  if (pid !== undefined) console.error(`- PID:          ${pid}`);
  if (dir !== undefined) console.error(`- Dir:          ${dir}`);
  console.error("");
  if (pid !== undefined) {
    console.error(`Run \`kill ${pid}\` to stop it.`);
  } else {
    console.error(
      `Stop the process listening on port ${port}, then try again.`,
    );
  }

  process.exit(1);
};

/**
 * If `port` is already taken, print a Next.js-style message with the listener's
 * PID (and cwd when available) and exit. Otherwise return and let the caller
 * bind the port.
 */
export const ensurePortAvailable = async (port: number): Promise<void> => {
  if (await canBind(port)) return;
  reportPortInUse(port);
};
