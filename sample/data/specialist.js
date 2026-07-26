// STATIC specialist fixtures. Hand-authored, same spirit as data/decisions.js.
// A future engine could compute criticality/urgency; the render layer only needs this shape.
// `because`, `note`, `outcome`, and history `val`s are trusted authored HTML (may contain <b>).
export const SPECIALIST = {
  online: 3,
  breakdown: '2 Critical · 2 High · 1 Moderate',

  queue: [
    { id: 'iss_087', type: 'Unauthorized charge', amountText: '$780.00', meta: 'iss_087 · R. Okoro · —— · 4h 12m',
      crit: 'crit', tier: 'Critical', cat: 'fraud', breach: true,
      bar: { fillPct: 100, kind: 'breach', word: 'act-by', limit: 'window spent — act now', elapsed: '' },
      prov: { mode: 'auto', reason: 'fraud always', ref: 63 } },
    { id: 'iss_099', type: 'Unauthorized charge', amountText: '$412.00', meta: 'iss_099 · T. Nguyen · —— · 20m',
      crit: 'crit', tier: 'Critical', cat: 'fraud',
      bar: { fillPct: 35, kind: 'act', word: 'act-by', limit: 'window 4h', elapsed: 'in queue 20m' },
      prov: { mode: 'auto', reason: 'fraud always', ref: 63 } },
    { id: 'iss_003', type: 'Dispute · not received', amountText: '$249.00', meta: 'iss_003 · M. Patel · FashionForward · 3h',
      crit: 'high', tier: 'High', cat: 'dispute',
      bar: { fillPct: 55, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 14', elapsed: 'in queue 3h' },
      prov: { mode: 'manual', reason: 'over $200', ref: 53 } },
    { id: 'iss_071', type: 'Exhausted retries', amountText: '$89.99', meta: 'iss_071 · A. Chen · TechGadgets · 1d',
      crit: 'high', tier: 'High', cat: 'retry',
      bar: { fillPct: 30, kind: 'act', word: 'act-by', limit: '3rd retry failed', elapsed: 'in queue 1d' },
      prov: { mode: 'auto', reason: '3rd retry', ref: 16 } },
    { id: 'iss_066', type: 'Dispute · not received', amountText: '$1,204', meta: 'iss_066 · T. Kim · SubscriptionBox · 5h',
      crit: 'mod', tier: 'Moderate', cat: 'highvalue', highValue: true,
      bar: { fillPct: 52, kind: 'reval', word: 're-evaluate', limit: 'awaiting comms', elapsed: 'in queue 5h' },
      prov: { mode: 'manual', reason: 'spend > $2000', ref: 54 } },
  ],

  mine: {
    investigating: [
      { id: 'iss_054', type: 'Dispute · not received', amountText: '$318.00', meta: 'iss_054 · D. Rossi · GearHub · 6h',
        crit: 'high', tier: 'High', cat: 'dispute', owner: 'you',
        bar: { fillPct: 58, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 15', elapsed: 'in queue 6h' },
        prov: { mode: 'manual', reason: 'over $200', ref: 53 } },
    ],
    onhold: [
      { id: 'iss_048', type: 'Unauthorized charge', amountText: '$540.00', meta: 'iss_048 · P. Silva · —— · 1d 2h',
        crit: 'mod', tier: 'Moderate', cat: 'fraud', owner: 'you',
        bar: { fillPct: 44, kind: 'reval', word: 're-evaluate', limit: 'bank response due', elapsed: 'held' },
        prov: { mode: 'auto', reason: 'fraud always', ref: 63 } },
    ],
    resolved: [
      { id: 'iss_040', type: 'Unauthorized', amountText: '$960.00', meta: 'iss_040 · L. Haddad · closed 2h',
        crit: 'crit', tier: 'Critical', cat: 'fraud', owner: 'you', bar: null,
        prov: { mode: 'auto', reason: 'fraud always', ref: 63 },
        outcome: 'fraud confirmed · account blocked · charge reversed' },
      { id: 'iss_033', type: 'Dispute', amountText: '$212.00', meta: 'iss_033 · N. Abara · closed 4h',
        crit: 'high', tier: 'High', cat: 'dispute', owner: 'you', bar: null,
        prov: { mode: 'manual', reason: 'over $200', ref: 53 },
        outcome: 'dispute denied · delivery confirmed' },
    ],
  },

  cases: {
    iss_003: {
      id: 'iss_003', txnId: 'txn_6103', type: 'Dispute · item not received', amountText: '$249.00',
      tier: 'High', crit: 'high', status: 'Investigating · yours',
      bar: { fillPct: 55, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 14', elapsed: 'in queue 3h' },
      prov: { mode: 'manual', by: 'operator', because: '<b>Alex Chen</b> reviewed this and escalated it — the dispute amount <b>$249 exceeds the $200 trigger</b>, which a standard operator can\'t clear. It landed in your queue, not resolved.', refs: [53] },
      history: [
        { actor: 'System', actorClass: '', when: 'Jan 13 · 08:15', line: 'Ticket created from txn_6103 — dispute, "item not received."' },
        { actor: 'Agent', actorClass: 'ag', ref: 51, st: 'rule not met', rows: [['RULE', 'Auto-resolve if tracking shows "delivered" + 3 days.'], ['EVIDENCE', 'Parcel is in transit → cannot auto-resolve.']] },
        { actor: 'Agent', actorClass: 'ag fired', ref: 53, st: 'rule fired', fired: true, rows: [['RULE', 'Escalate if dispute amount &gt; $200.'], ['EVIDENCE', '$249 &gt; $200 → recommend escalate to specialist.']] },
        { actor: 'Operator · Alex', actorClass: 'op', when: 'Jan 13 · 11:02', line: 'Claimed, confirmed the $200 trigger, escalated to the specialist board.', note: '"Customer says the parcel\'s been stuck in transit 5 days and wants a refund now. Tracking hasn\'t updated since Chicago."' },
        { actor: 'You · Sam', actorClass: 'you', end: true, endCrit: 'high', concl: 'Your terminal decision — refund, deny, or hold for the carrier scan.' },
      ],
      dataGap: { html: 'Policy REF55 / REF56 want <b>merchant fulfilment history, delivery-confirmation events, and customer comms history</b> to decide this. <b>None exist in the dataset</b> — merchant is a bare string. You\'re adjudicating on <b>amount + live tracking status</b> alone. The verdict is defensible, but the policy references evidence we don\'t capture.' },
      context: {
        left: { title: 'Customer', rows: [['Name', 'Morgan Patel'], ['Lifetime spend', '$312.00 · 2 transactions'], ['Disputes filed / won', '0 / 0'], ['Risk score', 'low']] },
        right: { title: 'Shipping', rows: [['Merchant', 'FashionForward'], ['Carrier / status', 'UPS · in transit'], ['Tracking', '1Z999AA10123456784'], ['Last update', 'Jan 12 · Chicago IL']] },
      },
      related: 'No other open tickets for this customer.',
      rail: {
        resolve: [
          { label: 'Refund customer $249', sub: 'reverse the charge · notify customer', variant: 'go' },
          { label: 'Deny dispute', sub: 'tracking active · no evidence of loss yet' },
        ],
        other: [{ label: 'Put on hold', sub: '⟳ await carrier scan · re-evaluate Jan 14' }],
      },
      terminalNote: 'This is the top of the ladder — there is no "escalate" from here. The decision is final and does not return to the operator.',
    },

    iss_099: {
      id: 'iss_099', txnId: 'txn_7740', type: 'Unauthorized charge', amountText: '$412.00',
      tier: 'Critical', crit: 'crit', status: 'Investigating · yours',
      bar: { fillPct: 35, kind: 'act', word: 'act-by', limit: 'window 4h', elapsed: 'in queue 20m' },
      prov: { mode: 'auto', by: 'agent', because: 'No human touched this. The agent auto-escalated it the instant it arrived — unauthorized-charge claims <b>always go straight to a specialist</b> and <b>can never be auto-resolved</b>. It <b>skipped the operator board entirely</b>.', refs: [63, 64] },
      history: [
        { actor: 'System', actorClass: '', when: 'Jan 13 · 09:40', line: 'Customer reported charge txn_7740 as "I didn\'t make this purchase."' },
        { actor: 'Agent', actorClass: 'ag', ref: 63, st: 'constraint', rows: [['RULE', 'Fraud claims — auto-resolve: <b>never</b>.'], ['EVIDENCE', 'Automation is forbidden from closing this. Human required.']] },
        { actor: 'Agent', actorClass: 'ag fired', ref: 64, st: 'rule fired', fired: true, rows: [['RULE', 'Unauthorized transaction — escalate <b>always, immediately</b>. Priority: high.'], ['EVIDENCE', 'Escalated to specialist on arrival, no operator step.']] },
        { actor: 'You · Sam', actorClass: 'you', end: true, endCrit: 'crit', concl: 'Your terminal decision — confirm fraud, clear the charge, or verify with the customer.' },
      ],
      dataGap: {
        html: 'Policy REF66 says adjudicating fraud needs <b>device fingerprint, IP address, and purchase patterns</b>. <b>None of them exist in the dataset.</b> You\'re asked to <b>confirm or clear fraud with zero fraud signals</b> — the only evidence is the customer\'s claim, the amount, and thin account history.',
        staged: '⚑ Staged case — no unauthorized-transaction ticket exists in the five fixtures; synthesised here to exercise the fraud path the policy demands but the data can\'t feed.',
      },
      context: {
        left: { title: 'Customer', rows: [['Name', 'T. Nguyen'], ['Account age', '3 weeks (new)'], ['Lifetime spend', '$980 · 3 transactions'], ['Disputes filed / won', '1 / 0'], ['Risk score', 'medium']] },
        right: { title: 'The charge', rows: [['Amount', '$412.00'], ['Payment method', 'card_visa_9981'], ['Device fingerprint', '— not captured (:66)', 'missing'], ['IP address', '— not captured (:66)', 'missing'], ['Purchase patterns', '— not available (:66)', 'missing']] },
      },
      related: '1 prior dispute filed by this customer (lost). No other open tickets.',
      rail: {
        resolve: [
          { label: 'Confirm fraud', sub: 'block account · reverse charge · flag device', variant: 'esc' },
          { label: 'Clear — legitimate charge', sub: 'dismiss claim · keep the charge' },
        ],
        other: [{ label: 'Contact customer to verify', sub: '⟳ await identity confirmation · on hold' }],
      },
      terminalNote: 'Top of the ladder — no "escalate" from here. Final, and does not return to the operator.',
    },
  },
};
