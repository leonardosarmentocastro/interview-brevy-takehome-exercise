import "dotenv/config";
import { fileURLToPath } from "node:url";
import { run } from "graphile-worker";
import { runnerOptions } from "@/queue/runner";

// apps/api/src/worker/start.ts -> apps/api/crontab
const crontabFile = fileURLToPath(new URL("../../crontab", import.meta.url));

const runner = await run({ ...runnerOptions, crontabFile });

console.log("worker started — tasks:", Object.keys(runnerOptions.taskList!));

await runner.promise;
