"use client";

import { useAtom } from "jotai";
import {
  specCatAtom,
  specQueryAtom,
} from "@/modules/specialists/data/atoms/filter";
import "../style.css";

const CHIPS = [
  { cat: "all", label: "All" },
  { cat: "fraud", label: "Fraud" },
  { cat: "dispute", label: "Disputes > $200" },
  { cat: "retry", label: "Exhausted retries" },
  { cat: "highvalue", label: "High-value" },
];

export function Toolbar() {
  const [cat, setCat] = useAtom(specCatAtom);
  const [query, setQuery] = useAtom(specQueryAtom);

  return (
    <div className="sbtools">
      <span className="tlbl">Sort</span>
      <span className="sortsel">Criticality → Urgency ▾</span>
      <div className="chips">
        {CHIPS.map((c) => (
          <button
            key={c.cat}
            type="button"
            className={`chip${cat === c.cat ? " on" : ""}`}
            onClick={() => setCat(c.cat)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        className="search sbsearch"
        placeholder="🔎 id / customer / merchant"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}
