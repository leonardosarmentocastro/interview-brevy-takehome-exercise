import { atom } from "jotai";

export const specCaptureAtom = atom<{ actionLabel: string } | null>(null);
export const specCaptureLogAtom = atom<string[]>([]);

export const openSpecCaptureAtom = atom(
  null,
  (_get, set, actionLabel: string) => set(specCaptureAtom, { actionLabel }),
);

export const confirmSpecCaptureAtom = atom(null, (get, set, reason: string) => {
  const current = get(specCaptureAtom);
  if (!current) return;
  set(specCaptureLogAtom, [
    ...get(specCaptureLogAtom),
    `${current.actionLabel} — ${reason}`,
  ]);
  set(specCaptureAtom, null);
});
