import { atom } from "jotai";

export const captureAtom = atom<{ actionLabel: string } | null>(null);
export const captureLogAtom = atom<string[]>([]);

export const openCaptureAtom = atom(
  null,
  (_get, set, actionLabel: string) => set(captureAtom, { actionLabel }),
);

export const confirmCaptureAtom = atom(null, (get, set, reason: string) => {
  const current = get(captureAtom);
  if (!current) return;
  set(captureLogAtom, [
    ...get(captureLogAtom),
    `${current.actionLabel} — ${reason}`,
  ]);
  set(captureAtom, null);
});
