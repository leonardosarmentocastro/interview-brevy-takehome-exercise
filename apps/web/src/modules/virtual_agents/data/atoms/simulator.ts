import { atom } from "jotai";
import type {
  IntakeItem,
  LogEntry,
  MonitorSnapshot,
  MonitorStats,
  SimPoolTicket,
  SimTicket,
  WaitItem,
} from "@/modules/virtual_agents/types";

export type IntakeQueueItem = IntakeItem | SimTicket;

export const intakeQueueAtom = atom<IntakeQueueItem[]>([]);
export const waitingAtom = atom<WaitItem[]>([]);
export const resolvedCountAtom = atom(0);
export const logAtom = atom<LogEntry[]>([]);
export const statsAtom = atom<MonitorStats>({
  resolved: 0,
  autoPct: 0,
  waiting: 0,
  humanReview: 0,
  escalated: 0,
});
export const simSeededAtom = atom(false);

const simPoolAtom = atom<SimPoolTicket[]>([]);
const simLeakAtom = atom<SimPoolTicket | null>(null);
const poolIdxAtom = atom(0);
const uidAtom = atom(0);

function nowClock(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function makeSimTicket(base: SimPoolTicket, uid: number): SimTicket {
  const id = `${base.id}_${uid}`;
  return {
    ...base,
    id,
    meta: base.meta.replace(/^[^·]+·/, `${id} ·`),
  };
}

export const simInitAtom = atom(null, (_get, set, snapshot: MonitorSnapshot) => {
  set(intakeQueueAtom, [...snapshot.intake]);
  set(waitingAtom, [...snapshot.waiting]);
  set(resolvedCountAtom, snapshot.resolved.count);
  set(logAtom, [...snapshot.log]);
  set(statsAtom, { ...snapshot.stats });
  set(simPoolAtom, [...snapshot.simPool]);
  set(simLeakAtom, snapshot.simLeak);
  set(poolIdxAtom, 0);
  set(uidAtom, 0);
  set(simSeededAtom, true);
});

export const pollAtom = atom(null, (get, set) => {
  const pool = get(simPoolAtom);
  if (pool.length === 0) return;
  let idx = get(poolIdxAtom);
  let uid = get(uidAtom);
  const next: SimTicket[] = [];
  for (let i = 0; i < 5; i++) {
    const base = pool[idx % pool.length];
    idx += 1;
    uid += 1;
    next.push(makeSimTicket(base, uid));
  }
  set(poolIdxAtom, idx);
  set(uidAtom, uid);
  set(intakeQueueAtom, [...get(intakeQueueAtom), ...next]);
});

export const leakAtom = atom(null, (get, set) => {
  const leak = get(simLeakAtom);
  if (!leak) return;
  const uid = get(uidAtom) + 1;
  set(uidAtom, uid);
  set(intakeQueueAtom, [...get(intakeQueueAtom), makeSimTicket(leak, uid)]);
});

function isSimTicket(entry: IntakeQueueItem): entry is SimTicket {
  return "dest" in entry && entry.dest != null;
}

export const nextAtom = atom(null, (get, set) => {
  const queue = get(intakeQueueAtom);
  if (queue.length === 0) return;
  const [entry, ...rest] = queue;
  set(intakeQueueAtom, rest);
  if (!isSimTicket(entry)) return;

  const t = nowClock();
  const refs = entry.rule ? [entry.rule] : [];

  if (entry.dest === "waiting") {
    const waitItem: WaitItem = {
      id: entry.id,
      type: entry.type,
      amountText: entry.amountText,
      meta: entry.meta,
      blocker: entry.blocker ?? "",
    };
    set(waitingAtom, [waitItem, ...get(waitingAtom)]);
    const stats = get(statsAtom);
    set(statsAtom, { ...stats, waiting: stats.waiting + 1 });
    const blockerText = (entry.blocker ?? "").replace(/^[^ ]+ /, "");
    set(logAtom, [
      {
        t,
        kind: "grab",
        text: `<b>${entry.id}</b> holding — ${blockerText}`,
        refs,
      },
      ...get(logAtom),
    ]);
  } else if (entry.dest === "resolved") {
    set(resolvedCountAtom, get(resolvedCountAtom) + 1);
    const stats = get(statsAtom);
    set(statsAtom, { ...stats, resolved: stats.resolved + 1 });
    set(logAtom, [
      {
        t,
        kind: "resolved",
        text: `<b>${entry.id}</b> resolved automatically — ${entry.destNote ?? ""}`,
        refs,
      },
      ...get(logAtom),
    ]);
  } else if (entry.dest === "human_review") {
    const stats = get(statsAtom);
    set(statsAtom, { ...stats, humanReview: stats.humanReview + 1 });
    set(logAtom, [
      {
        t,
        kind: "leak",
        text: `<b>${entry.id}</b> — policy couldn’t decide (${entry.reason ?? ""}) → sent for human review`,
        refs,
      },
      ...get(logAtom),
    ]);
  }
});
