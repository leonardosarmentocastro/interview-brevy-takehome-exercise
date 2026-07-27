import type { UrgencyBar as UrgencyBarData } from "@/modules/specialists/types";
import "../style.css";

const BAR_ICON: Record<string, string> = {
  act: "⚠",
  breach: "⚠",
  reval: "⟳",
};

export function UrgencyBar({
  bar,
  crit = "high",
}: {
  bar: UrgencyBarData;
  crit?: string;
}) {
  const isBreach = bar.kind === "breach";
  const fill = isBreach ? "ufil full" : `ufil ${crit}`;
  const endClass = isBreach ? "uend breach" : "uend";
  const width = isBreach ? "100%" : `${bar.fillPct}%`;

  return (
    <div className="ubar">
      <div className="utrk">
        <div className={fill} style={{ width }}>
          {bar.elapsed ? <span className="uel">{bar.elapsed}</span> : null}
          <span className="uedge" />
        </div>
      </div>
      <div className={endClass}>
        <span className="mk">{BAR_ICON[bar.kind]}</span>
        <span className="wd">{bar.word}</span>
        <span>· {bar.limit}</span>
      </div>
    </div>
  );
}
