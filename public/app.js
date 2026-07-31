/* Kitsune Content Studio — the firm's real publishing tool.
 *
 * A self-contained, browser-persistent app (localStorage). No fake samples:
 * the pipeline and library start empty and fill with what YOU actually create
 * and publish. Your data survives reloads and app updates.
 *
 * Two content tracks:
 *   - guide:      evergreen, high-intent SEO pages (client acquisition)
 *   - commentary: timely takes on AI-law / rulemaking developments that affect
 *                 your target clients (thought leadership)
 *
 * Multi-platform: each piece carries a channel plan (firm site / Substack /
 * LinkedIn / X / other) driven by a strategy playbook.
 *
 * Legal-review gate preserved: nothing is marked Published without a named
 * reviewer of record — but the reviewer is whoever YOU name, not a fake.
 */

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'kitsune.content.v2';

const PLATFORMS = {
  firm_site: { label: 'Firm site / blog', note: 'Your owned home base — canonical URL, SEO, no algorithm risk.' },
  substack: { label: 'Substack', note: 'Long-form deep dives + the weekly digest; owns the email relationship.' },
  linkedin: { label: 'LinkedIn', note: 'Where B2B legal buyers (founders + GCs) actually are; professional takes.' },
  x: { label: 'X', note: 'Fast reactions to breaking developments; threads; reach and discovery.' },
  other: { label: 'Other', note: 'YouTube, Threads, Reddit, guest posts, bar publications — situational.' },
};

/** The four things worth watching, each a distinct commentary track. */
const TRACKS = ['regulatory', 'legal_ai', 'frontier_model', 'ai_trend'];
const TRACK_LABEL = {
  regulatory: 'Law & regulation',
  legal_ai: 'Legal AI & the market',
  frontier_model: 'Frontier models & capabilities',
  ai_trend: 'AI trends & adoption',
};
const TRACK_NOTE = {
  regulatory: 'Statutes, rules, enforcement, and litigation that change what your clients must do.',
  legal_ai: 'Tools, funding, and the practice-of-law questions your GC clients are living through.',
  frontier_model: 'New models, capability jumps, and agents — what your founder clients are building on.',
  ai_trend: 'Where enterprise AI adoption, governance, and strategy are heading.',
};

/** Starter watchlist: real CATEGORIES to monitor — not fabricated news. Edit
 *  these to your practice; log specific developments under them as they happen. */
function starterDevelopments() {
  const mk = (track, category, title, audience, why) => ({
    id: uid('dev'), track, category, title, audience, whyItMatters: why,
    sourceUrl: '', status: 'watching', noticedAt: nowISO(), relatedPieceId: null,
  });
  return [
    // Law & regulation
    mk('regulatory', 'AI product & liability', 'AI product-defect & liability theories', 'founders', 'Founders shipping AI products face evolving negligence and product-liability exposure.'),
    mk('regulatory', 'AI employment law', 'State automated-decision / AI-in-hiring rules', 'both', 'NYC LL144, the Colorado AI Act, Illinois and others reach any client using AI in HR.'),
    mk('regulatory', 'Securities / disclosure', 'SEC "AI-washing" & disclosure enforcement', 'founders', 'Venture-backed companies over-claiming AI capabilities face disclosure risk.'),
    mk('regulatory', 'Privacy', 'State comprehensive privacy laws + AI rules', 'both', 'New state privacy regimes and AI-specific rules reshape data practices for everyone.'),
    mk('regulatory', 'IP / training data', 'Copyright & AI training-data litigation', 'founders', 'AI companies must track how courts treat training data and model outputs.'),
    // Legal AI & the market
    mk('legal_ai', 'Legal-AI tooling', 'Legal-AI tools, funding & adoption (Harvey, Legora, CoCounsel, etc.)', 'gc', 'GCs and legal-ops teams are choosing tools now; a POV on the market builds authority and pipeline.'),
    mk('legal_ai', 'Practice of law', 'AI & the ethics of practicing law (UPL, competence, confidentiality)', 'gc', 'Bar rules on AI competence and supervision are moving; your clients want guidance they can trust.'),
    // Frontier models & capabilities
    mk('frontier_model', 'Model releases', 'Frontier model releases & capability jumps', 'founders', 'Founders build on the frontier; each release shifts what is possible — and the legal questions that follow.'),
    mk('frontier_model', 'Agents & autonomy', 'Agentic AI & autonomous workflows', 'both', 'As agents take actions, liability, authority, and contracting questions get real for builders and buyers.'),
    // AI trends & adoption
    mk('ai_trend', 'Enterprise adoption', 'Enterprise AI governance & adoption', 'gc', 'How large organizations govern AI is the question your GC clients are being asked by their boards.'),
    mk('ai_trend', 'Data & IP strategy', 'AI data strategy, licensing & IP posture', 'founders', 'Training-data sourcing and IP posture are becoming board-level questions for AI startups.'),
  ];
}

/** A curated starting reading list of real, well-known outlets, by track.
 *  Swap these for your own feeds — they're suggestions, not a fixed list. */
function starterSources() {
  const mk = (track, label, note) => ({ id: uid('src'), track, label, note });
  return [
    // Frontier models & capabilities
    mk('frontier_model', 'Anthropic — news & research', 'anthropic.com/news — model releases, capabilities, usage policies.'),
    mk('frontier_model', 'OpenAI & Google DeepMind blogs', 'Primary-source release notes and capability announcements.'),
    mk('frontier_model', 'Import AI (Jack Clark)', 'Weekly newsletter on frontier research and its implications.'),
    // Legal AI & the market
    mk('legal_ai', 'Artificial Lawyer', 'The go-to for legal-AI tools, funding, and adoption.'),
    mk('legal_ai', 'LawSites / LawNext (Bob Ambrogi)', 'Legal-tech news and the market for GC/legal-ops buyers.'),
    mk('legal_ai', 'Legaltech News (ALM)', 'Legal industry technology coverage.'),
    // Law & regulation
    mk('regulatory', 'Federal Register & agency dockets', 'Proposed/final AI & privacy rules; comment periods to flag to clients.'),
    mk('regulatory', 'IAPP — privacy & AI governance', 'Global privacy/AI regulation, well-summarized.'),
    mk('regulatory', 'Lawfare — tech & national-security law', 'Serious analysis of AI law and policy.'),
    mk('regulatory', 'NCSL state AI legislation tracker', 'Where most near-term obligations originate — by state.'),
    // AI trends & adoption
    mk('ai_trend', 'Stratechery (Ben Thompson)', 'Strategy and the business of AI — how the market is moving.'),
    mk('ai_trend', 'The Batch (DeepLearning.AI)', 'Weekly roundup of notable AI developments and trends.'),
    mk('ai_trend', 'One Useful Thing (Ethan Mollick)', 'Applied AI — what enterprises are actually doing with it.'),
  ];
}

/** Labels the old generic starter sources used — to detect an untouched list. */
const OLD_SOURCE_LABELS = new Set([
  'Frontier-lab release notes & blogs', 'Legal-AI trade press (e.g., Artificial Lawyer, LawNext)',
  'Federal Register & agency rule dockets', 'State AG & legislature trackers',
  'Court dockets & AI-litigation trackers', "VC / startup press & the labs' announcements",
]);

function freshState() {
  return {
    version: 4,
    settings: { firmName: 'Kitsune Law', authorName: '', defaultReviewer: '' },
    pieces: [],
    developments: starterDevelopments(),
    sources: starterSources(),
    strategyNotes: '',
    initialized: true,
  };
}

/** Upgrade older saved data in place — never wipe the founder's real work. */
function migrate(s) {
  if (!s || typeof s !== 'object') return freshState();
  if (!Array.isArray(s.developments)) s.developments = [];
  for (const d of s.developments) if (!d.track) d.track = 'regulatory';
  if (!Array.isArray(s.pieces)) s.pieces = [];
  for (const p of s.pieces) if (!('targetDate' in p)) p.targetDate = null;
  // Sources: seed if missing; upgrade the untouched generic list to the curated one.
  if (!Array.isArray(s.sources) || !s.sources.length) {
    s.sources = starterSources();
  } else if (s.sources.every((x) => OLD_SOURCE_LABELS.has(x.label))) {
    s.sources = starterSources(); // still the old defaults, unedited → upgrade
  } else {
    for (const x of s.sources) if (!x.track) x.track = 'general';
  }
  s.version = 4;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* ignore */ }
  return freshState();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

let _seq = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}${(_seq++).toString(36)}`;
const nowISO = () => new Date().toISOString();

// Initialize state after the id/time helpers exist (freshState uses them).
let state = load();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (iso) => (iso ? String(iso).slice(0, 10) : '—');
const $view = document.getElementById('view');
const $nav = document.getElementById('nav');

let toastTimer;
function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast${isError ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4200);
}
function statusChip(grade, text) { return `<span class="status ${grade}"><span class="dot"></span>${esc(text)}</span>`; }

const TYPE_LABEL = { guide: 'Evergreen guide', commentary: 'Commentary' };
const AUDIENCE_LABEL = { founders: 'Founders', gc: 'GCs / legal-ops', both: 'Founders + GCs' };
const STATUS = ['idea', 'drafting', 'in_review', 'approved', 'published'];
const STATUS_LABEL = { idea: 'Idea', drafting: 'Drafting', in_review: 'In review', approved: 'Approved', published: 'Published' };
const STATUS_GRADE = { idea: 'warning', drafting: 'warning', in_review: 'warning', approved: 'good', published: 'good' };

function getPiece(id) { return state.pieces.find((p) => p.id === id); }

// ---------------------------------------------------------------------------
// Channel strategy
// ---------------------------------------------------------------------------

function suggestChannels(type, audience) {
  if (type === 'guide') {
    const c = [
      { platform: 'firm_site', format: 'Full SEO guide — the canonical home URL', status: 'planned', url: '', publishedAt: null },
      { platform: 'substack', format: 'Deep-dive issue emailed to subscribers', status: 'planned', url: '', publishedAt: null },
      { platform: 'linkedin', format: 'Summary post with a link back to the guide', status: 'planned', url: '', publishedAt: null },
    ];
    if (audience !== 'gc') c.push({ platform: 'x', format: 'Thread pulling out the 3 key takeaways', status: 'planned', url: '', publishedAt: null });
    return c;
  }
  const c = [
    { platform: 'x', format: 'Fast reaction thread (aim: within 48h)', status: 'planned', url: '', publishedAt: null },
    { platform: 'linkedin', format: 'Professional analysis: what it means for you', status: 'planned', url: '', publishedAt: null },
    { platform: 'substack', format: 'Fold into the weekly developments digest', status: 'planned', url: '', publishedAt: null },
  ];
  return c;
}

function scaffoldBody(type, audience, track) {
  const who = (AUDIENCE_LABEL[audience] || 'your clients').toUpperCase();
  if (type === 'guide') {
    return [
      'EXECUTIVE ANSWER — the one-paragraph answer to the search query.', '',
      'LEGAL FRAMEWORK — the governing statutes/regs and how they apply.', '',
      'DECISION TREE — if X then Y (the branches a reader falls into).', '',
      'OPTIONS — accept / mitigate / remediate, and when each fits.', '',
      'RISKS & LIMITATIONS — deadlines, downside, what this page is NOT.', '',
      'FAQ — the 3–5 questions people actually ask.', '',
      `CTA — the offer that fits (${AUDIENCE_LABEL[audience] || 'your clients'}).`,
    ].join('\n');
  }
  // Commentary — the outline adapts to the development's track.
  if (track === 'frontier_model') {
    return [
      'WHAT SHIPPED — the model / capability, in two sentences, with the source link.', '',
      `WHY IT MATTERS FOR ${who} — concretely, for what they\'re building.`, '',
      'LEGAL IMPLICATIONS — IP, liability, contracts, compliance the release touches.', '',
      'WHAT TO DO NOW — the concrete step for a builder this week.', '',
      'OUR TAKE — the firm\'s point of view; where the hype is wrong.', '',
      'CTA — soft: "we help AI companies navigate exactly this."',
    ].join('\n');
  }
  if (track === 'legal_ai') {
    return [
      'WHAT\'S NEW — the tool / deal / rule, with the source link.', '',
      `WHAT IT MEANS FOR ${who} — for legal ops and how work gets done.`, '',
      'RISK & GOVERNANCE ANGLE — confidentiality, competence, supervision, provenance.', '',
      'HOW TO EVALUATE IT — the questions a buyer should actually ask.', '',
      'OUR TAKE — where we agree, where we\'d push back.', '',
      'CTA — soft: "we advise on legal-AI adoption and governance."',
    ].join('\n');
  }
  if (track === 'ai_trend') {
    return [
      'THE TREND — what\'s shifting, in two sentences, with a source.', '',
      `WHY IT MATTERS FOR ${who} — the strategic stake.`, '',
      'THE LEGAL DIMENSION — the contracts / IP / regulatory thread others miss.', '',
      'WHAT TO DO NOW — the move to make before it\'s obvious.', '',
      'OUR TAKE — the contrarian-but-right position.', '',
      'CTA — soft.',
    ].join('\n');
  }
  return [ // regulatory / default
    'WHAT HAPPENED — the development, in two sentences, with the source link.', '',
    `WHY IT MATTERS FOR ${who} — the specific exposure or opportunity.`, '',
    'WHAT TO DO NOW — the concrete next step (this week).', '',
    'OUR TAKE — the firm\'s point of view; where others are wrong.', '',
    'CTA — soft: "we help with exactly this."',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Piece lifecycle
// ---------------------------------------------------------------------------

function newPiece(type, opts = {}) {
  const audience = opts.audience || 'founders';
  const track = opts.track || 'regulatory';
  const piece = {
    id: uid('pc'), type, title: '', audience, topic: opts.topic || '',
    hook: '', angle: '', track, body: scaffoldBody(type, audience, track),
    status: 'idea', reviewer: '', reviewedAt: null, createdAt: nowISO(), targetDate: null, publishedAt: null,
    channels: suggestChannels(type, audience), sourceDevelopmentId: opts.sourceDevelopmentId || null,
    disclaimer: 'General information, not legal advice, until a client engagement is formed.',
  };
  state.pieces.unshift(piece);
  save();
  return piece;
}

function advance(piece, to) {
  if (to === 'approved' && !piece.reviewer.trim()) { toast('Name a reviewer of record before approving.', true); return false; }
  if (to === 'published') {
    if (piece.status !== 'approved') { toast('Approve the piece before publishing.', true); return false; }
    const live = piece.channels.filter((c) => c.status === 'published');
    if (!live.length) { toast('Mark at least one channel as published (with its live URL) first.', true); return false; }
    piece.publishedAt = nowISO();
  }
  if (to === 'approved') piece.reviewedAt = nowISO();
  piece.status = to;
  save();
  return true;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function renderPipeline() {
  const counts = Object.fromEntries(STATUS.map((s) => [s, state.pieces.filter((p) => p.status === s).length]));
  const active = state.pieces.filter((p) => p.status !== 'published');
  const needsReviewer = !state.settings.authorName;

  $view.innerHTML = `
    <div class="row-between" style="align-items:flex-end">
      <div>
        <h1>Pipeline</h1>
        <p class="subhead">Everything you're working on. Nothing here is a sample — it fills as you create. Draft an evergreen guide to win search traffic, or a commentary to ride a live development.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn primary" data-new="guide">+ New guide</button>
        <button class="btn" data-new="commentary">+ New commentary</button>
      </div>
    </div>
    ${needsReviewer ? `<div class="card wash" style="margin-bottom:14px"><p class="locked-note">Set your name and reviewer in <a href="#/settings">Settings</a> so approvals and bylines are attributed to you — not a placeholder.</p></div>` : ''}

    <div class="bento" style="margin-bottom:10px">
      ${STATUS.map((s) => `<div class="card tile b3" style="min-height:auto"><div class="tile-label">${esc(STATUS_LABEL[s])}</div><div class="tile-value" style="font-size:26px">${counts[s]}</div></div>`).join('')}
    </div>

    <div class="section-title">In progress</div>
    ${active.length ? `<div class="grid cards">${active.map(pieceCard).join('')}</div>`
      : `<div class="card"><p class="empty">Nothing in progress yet. Start with <strong>+ New guide</strong> for evergreen client-acquisition content, or <strong>+ New commentary</strong> to weigh in on something happening in AI law right now.</p></div>`}
  `;
}

function pieceCard(p) {
  const planned = p.channels.filter((c) => c.status !== 'published').length;
  const live = p.channels.filter((c) => c.status === 'published').length;
  return `<div class="card clickable" data-open="${esc(p.id)}">
    <div class="row-between"><span class="badge ${p.type === 'commentary' ? 'cat-decision' : ''}">${esc(TYPE_LABEL[p.type])}</span>${statusChip(STATUS_GRADE[p.status], STATUS_LABEL[p.status])}</div>
    <strong style="display:block;margin:8px 0 4px;font-size:14px">${esc(p.title || '(untitled)')}</strong>
    <div class="meta-row">${esc(AUDIENCE_LABEL[p.audience])}${p.topic ? ' · ' + esc(p.topic) : ''}</div>
    <div class="meta-row" style="margin-top:6px">${live ? `<span>${live} live</span>` : ''}<span>${planned} channel${planned === 1 ? '' : 's'} planned</span></div>
  </div>`;
}

function renderEditor(id) {
  const p = getPiece(id);
  if (!p) { location.hash = '#/'; return; }
  const devOptions = state.developments.map((d) => `<option value="${esc(d.id)}"${p.sourceDevelopmentId === d.id ? ' selected' : ''}>${esc(d.title)}</option>`).join('');
  const idx = STATUS.indexOf(p.status);

  $view.innerHTML = `
    <div class="breadcrumb"><a href="#/">Pipeline</a> / ${esc(TYPE_LABEL[p.type])}</div>
    <div class="row-between" style="align-items:flex-start">
      <h1 style="max-width:60ch">${esc(p.title || 'Untitled ' + TYPE_LABEL[p.type].toLowerCase())}</h1>
      <button class="btn danger" data-delete="${esc(p.id)}" style="flex:0 0 auto">Delete</button>
    </div>
    <div class="badges" style="margin-bottom:16px">${STATUS.map((s, i) => `<span class="badge ${i <= idx ? 'tier-3' : ''}">${esc(STATUS_LABEL[s])}</span>${i < STATUS.length - 1 ? ' → ' : ''}`).join('')}</div>

    <div class="grid two-col">
      <div class="card" data-piece="${esc(p.id)}">
        <div class="section-title" style="margin-top:0">The piece</div>
        <label class="fld"><span>Title / headline</span><input type="text" data-f="title" value="${esc(p.title)}" placeholder="${p.type === 'guide' ? 'e.g. Missed the 83(b) deadline? Options for Delaware founders' : 'e.g. What the new state AI-hiring rule means for your startup'}" /></label>
        <div class="fld-row">
          <label class="fld"><span>Audience</span><select data-f="audience">${Object.entries(AUDIENCE_LABEL).map(([k, v]) => `<option value="${k}"${p.audience === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
          <label class="fld"><span>Topic</span><input type="text" data-f="topic" value="${esc(p.topic)}" placeholder="e.g. 83(b), AI hiring, privacy" /></label>
        </div>
        ${p.type === 'commentary'
          ? `<div class="fld-row">
              <label class="fld"><span>Track</span><select data-f="track">${TRACKS.map((tk) => `<option value="${tk}"${(p.track || 'regulatory') === tk ? ' selected' : ''}>${esc(TRACK_LABEL[tk])}</option>`).join('')}</select></label>
              <label class="fld"><span>Development it responds to</span><select data-f="sourceDevelopmentId"><option value="">— none / ad hoc —</option>${devOptions}</select></label>
            </div>
            <p class="locked-note" style="margin:-6px 0 12px">Changing the track then <em>Reset to scaffold</em> gives you an outline tuned to that kind of development.</p>`
          : `<label class="fld"><span>Trigger / deadline hook</span><input type="text" data-f="hook" value="${esc(p.hook)}" placeholder="e.g. 30-day 83(b) window" /></label>`}
        <label class="fld"><span>Angle (one-line thesis)</span><input type="text" data-f="angle" value="${esc(p.angle)}" placeholder="The single point a reader should leave with" /></label>
        <label class="fld"><span>Body / draft notes</span><textarea data-f="body" rows="14">${esc(p.body)}</textarea></label>
        <button class="btn" data-scaffold="${esc(p.id)}">↻ Reset to a structured scaffold</button>
      </div>

      <div>
        <div class="card" data-piece="${esc(p.id)}">
          <div class="section-title" style="margin-top:0">Review gate</div>
          <p class="locked-note" style="margin-bottom:10px">Legal content doesn't publish without a named reviewer of record. This is your firm's gate — the reviewer is whoever you name.</p>
          <div class="fld-row">
            <label class="fld"><span>Reviewer of record</span><input type="text" data-f="reviewer" value="${esc(p.reviewer || state.settings.defaultReviewer || '')}" placeholder="Attorney who reviewed this" /></label>
            <label class="fld"><span>Target publish date</span><input type="date" data-f="targetDate" value="${esc(p.targetDate || '')}" /></label>
          </div>
          <div class="task-actions">
            ${p.status === 'idea' || p.status === 'drafting' ? `<button class="btn" data-advance="${esc(p.id)}" data-to="in_review">Send to review →</button>` : ''}
            ${p.status === 'in_review' ? `<button class="btn primary" data-advance="${esc(p.id)}" data-to="approved">Approve →</button>` : ''}
            ${p.status === 'approved' ? `<button class="btn primary" data-advance="${esc(p.id)}" data-to="published">Mark published →</button>` : ''}
            ${p.status === 'published' ? statusChip('good', 'Published ' + day(p.publishedAt)) : ''}
          </div>
          ${p.reviewedAt ? `<p class="locked-note" style="margin-top:8px">Approved by ${esc(p.reviewer)} on ${day(p.reviewedAt)}.</p>` : ''}
        </div>

        <div class="card" style="margin-top:12px" data-piece="${esc(p.id)}">
          <div class="section-title" style="margin-top:0">Channel plan <a href="#/strategy" style="font-size:11px;font-weight:500;text-transform:none;letter-spacing:0">strategy →</a></div>
          <p class="locked-note" style="margin-bottom:8px">Where this goes and how it's adapted. Mark a channel published and paste the live URL as you post it — that's what fills your Library.</p>
          ${p.channels.map((c, i) => channelRow(p, c, i)).join('')}
          <div style="margin-top:8px">${Object.keys(PLATFORMS).filter((pl) => !p.channels.some((c) => c.platform === pl)).map((pl) => `<button class="btn" data-addchan="${esc(p.id)}" data-pl="${pl}" style="font-size:11px;padding:4px 9px">+ ${esc(PLATFORMS[pl].label)}</button> `).join('')}</div>
        </div>
      </div>
    </div>
  `;
}

function channelRow(p, c, i) {
  return `<div style="border-bottom:1px solid var(--line);padding:8px 0" data-piece="${esc(p.id)}" data-ci="${i}">
    <div class="row-between"><strong style="font-size:12.5px">${esc(PLATFORMS[c.platform].label)}</strong>
      <span style="display:flex;gap:6px;align-items:center">
        ${c.status === 'published' ? statusChip('good', 'live') : statusChip('warning', 'planned')}
        <button class="btn" data-rmchan="${esc(p.id)}" data-ci="${i}" style="font-size:10px;padding:2px 7px">×</button>
      </span>
    </div>
    <input type="text" data-cf="format" data-ci="${i}" value="${esc(c.format)}" placeholder="Format / adaptation" style="width:100%;margin-top:6px;font-size:12px;padding:6px 9px;border-radius:3px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink-1)" />
    <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
      <input type="text" data-cf="url" data-ci="${i}" value="${esc(c.url)}" placeholder="Live URL (once posted)" style="flex:1;font-size:12px;padding:6px 9px;border-radius:3px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink-1)" />
      <button class="btn ${c.status === 'published' ? '' : 'primary'}" data-togglechan="${esc(p.id)}" data-ci="${i}" style="font-size:11px;padding:5px 10px;flex:0 0 auto">${c.status === 'published' ? 'Mark planned' : 'Mark published'}</button>
    </div>
  </div>`;
}

function renderRadar() {
  const watching = state.developments.filter((d) => d.status === 'watching');
  const commented = state.developments.filter((d) => d.status === 'commented');

  const trackSections = TRACKS.map((tk) => {
    const items = watching.filter((d) => d.track === tk);
    return `<div class="section-title">${esc(TRACK_LABEL[tk])} <button class="btn" data-adddev="${tk}" style="font-size:10.5px;padding:3px 9px;text-transform:none;letter-spacing:0;font-weight:600">+ Add</button></div>
      <p class="locked-note" style="margin:-8px 0 12px">${esc(TRACK_NOTE[tk])}</p>
      ${items.length ? `<div class="grid cards">${items.map(devCard).join('')}</div>`
        : `<p class="empty" style="margin-bottom:6px">Nothing here yet — add a development to watch and comment on.</p>`}`;
  }).join('');

  $view.innerHTML = `
    <h1>Radar</h1>
    <p class="subhead">Developments worth commenting on — across law and regulation, the Legal AI market, frontier-model releases, and AI trends. This is your thought-leadership engine: watch a category, log a real development (with its source), then spin up a commentary. These are editable starting points, not fixed.</p>

    ${trackSections}

    ${commented.length ? `<div class="section-title">Commented</div><div class="grid cards">${commented.map(devCard).join('')}</div>` : ''}

    <div class="section-title">Where to watch</div>
    <p class="locked-note" style="margin:-8px 0 12px">A starting reading list of real outlets, grouped by track — swap in your own feeds. (The tool can't fetch live news itself; this is where you turn a real development into commentary.)</p>
    <div class="card" id="sources">
      ${[...TRACKS, 'general'].map((tk) => {
        const items = state.sources.filter((s) => (s.track || 'general') === tk);
        if (tk === 'general' && !items.length) return '';
        return `<div class="row-between" style="margin:10px 0 6px;align-items:center">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-3)">${esc(TRACK_LABEL[tk] || 'General')}</span>
            <button class="btn" data-addsrc="${tk}" style="font-size:10px;padding:2px 8px">+ Add</button>
          </div>
          ${items.map((s) => `<div class="row-between" data-src="${esc(s.id)}" style="padding:6px 0;border-bottom:1px solid var(--line);gap:10px">
            <div style="flex:1"><input type="text" data-sf="label" value="${esc(s.label)}" placeholder="Source name" style="width:100%;font-weight:600;font-size:12.5px;border:none;background:transparent;color:var(--ink-1)" /><input type="text" data-sf="note" value="${esc(s.note)}" placeholder="What it's good for" style="width:100%;font-size:11.5px;color:var(--ink-2);border:none;background:transparent" /></div>
            <button class="btn" data-rmsrc="${esc(s.id)}" style="font-size:10px;padding:2px 8px;flex:0 0 auto">×</button>
          </div>`).join('') || '<p class="empty" style="font-size:12px;padding:2px 0">—</p>'}`;
      }).join('')}
    </div>
  `;
}

function devCard(d) {
  const piece = d.relatedPieceId ? getPiece(d.relatedPieceId) : null;
  return `<div class="card" data-dev="${esc(d.id)}">
    <div class="row-between">
      <select data-devtrack="${esc(d.id)}" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-3);border:1px solid var(--line);border-radius:2px;background:var(--surface-2);padding:2px 5px">
        ${TRACKS.map((tk) => `<option value="${tk}"${d.track === tk ? ' selected' : ''}>${esc(TRACK_LABEL[tk])}</option>`).join('')}
      </select>
      <span class="badge">${esc(AUDIENCE_LABEL[d.audience] || d.audience)}</span>
    </div>
    <input type="text" data-df="title" value="${esc(d.title)}" placeholder="Development / category" style="width:100%;font-weight:600;font-size:13.5px;margin:8px 0 4px;border:none;background:transparent;color:var(--ink-1);font-family:var(--serif)" />
    <textarea data-df="whyItMatters" rows="2" placeholder="Why it matters for your clients" style="width:100%;font-size:12.5px;color:var(--ink-2);border:none;background:transparent;resize:vertical">${esc(d.whyItMatters)}</textarea>
    <input type="text" data-df="sourceUrl" value="${esc(d.sourceUrl)}" placeholder="Source link (once you spot a real development)" style="width:100%;font-size:11.5px;margin-top:6px;padding:5px 8px;border-radius:3px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink-1)" />
    <div class="task-actions">
      ${piece ? `<a class="btn" href="#/piece/${esc(piece.id)}">Open commentary →</a>` : `<button class="btn primary" data-draftdev="${esc(d.id)}">Draft commentary →</button>`}
      <button class="btn" data-rmdev="${esc(d.id)}" style="font-size:11px">Remove</button>
    </div>
  </div>`;
}

function renderStrategy() {
  const play = (title, rows) => `<div class="card" style="margin-bottom:12px"><div class="section-title" style="margin-top:0">${title}</div>${rows}</div>`;
  const chanList = Object.entries(PLATFORMS).map(([k, v]) => `<p style="font-size:13px;padding:4px 0"><strong>${esc(v.label)}</strong> — <span style="color:var(--ink-2)">${esc(v.note)}</span></p>`).join('');
  $view.innerHTML = `
    <h1>Channel Strategy</h1>
    <p class="subhead">What goes where, and why. The mix aims for roughly 60% evergreen guides (compounding search traffic) and 40% commentary (timely reach and authority). A big share of that commentary is your take on AI developments — frontier-model releases, the Legal AI market, and AI trends — because that's what earns attention from founders and GCs. Comment within about 48 hours, while it's live.</p>

    ${play('Comment on AI developments — the four tracks', `
      <p style="font-size:13px;padding:3px 0"><strong>${esc(TRACK_LABEL.regulatory)}:</strong> ${esc(TRACK_NOTE.regulatory)}</p>
      <p style="font-size:13px;padding:3px 0"><strong>${esc(TRACK_LABEL.legal_ai)}:</strong> ${esc(TRACK_NOTE.legal_ai)}</p>
      <p style="font-size:13px;padding:3px 0"><strong>${esc(TRACK_LABEL.frontier_model)}:</strong> ${esc(TRACK_NOTE.frontier_model)}</p>
      <p style="font-size:13px;padding:3px 0"><strong>${esc(TRACK_LABEL.ai_trend)}:</strong> ${esc(TRACK_NOTE.ai_trend)}</p>
      <p class="locked-note" style="margin-top:6px">Frontier-model &amp; trend takes skew founders (X + LinkedIn); Legal-AI-market takes skew GCs (LinkedIn + Substack). Draft these from the <a href="#/radar">Radar</a>.</p>`)}

    ${play('The platforms', chanList)}

    ${play('Evergreen guide → distribution', `
      <p style="font-size:13px;padding:3px 0"><strong>Primary:</strong> Firm site — the canonical, SEO-optimized home the others link back to.</p>
      <p style="font-size:13px;padding:3px 0"><strong>Amplify:</strong> Substack (deep-dive issue to subscribers) · LinkedIn (summary + link).</p>
      <p style="font-size:13px;padding:3px 0"><strong>Founder topics also:</strong> an X thread of the 3 key takeaways.</p>`)}

    ${play('Commentary → distribution', `
      <p style="font-size:13px;padding:3px 0"><strong>Primary:</strong> X (fast reaction thread, within ~48h) + LinkedIn (professional "what it means for you" analysis).</p>
      <p style="font-size:13px;padding:3px 0"><strong>Roundup:</strong> fold the week's developments into a Substack digest.</p>`)}

    ${play('By audience', `
      <p style="font-size:13px;padding:3px 0"><strong>Founders / venture-backed:</strong> LinkedIn + X heavier; equity, financing, AI-product, regulatory.</p>
      <p style="font-size:13px;padding:3px 0"><strong>GCs / legal-ops:</strong> LinkedIn + Substack heavier; AI governance, contracting, vendor selection, decision provenance.</p>`)}

    <div class="section-title">Your notes</div>
    <div class="card"><textarea id="strategy-notes" rows="5" placeholder="Cadence targets, campaigns, series ideas, who drafts vs. who reviews…" style="width:100%;font-size:13px;padding:10px;border-radius:3px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink-1)">${esc(state.strategyNotes)}</textarea></div>
  `;
}

let calCursor = null; // { y, m } — the month being viewed

function renderCalendar() {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (!calCursor) calCursor = { y: today.getUTCFullYear(), m: today.getUTCMonth() };
  const { y, m } = calCursor;

  // Each piece plots on its publish date (if published) or its target date.
  const byDate = {};
  for (const p of state.pieces) {
    const iso = p.status === 'published' ? p.publishedAt : p.targetDate;
    if (!iso) continue;
    const key = String(iso).slice(0, 10);
    (byDate[key] = byDate[key] || []).push(p);
  }

  // Cadence stats.
  const cut = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const pubRecent = state.pieces.filter((p) => p.status === 'published' && String(p.publishedAt).slice(0, 10) >= cut);
  const upcoming = state.pieces.filter((p) => p.status !== 'published' && p.targetDate && p.targetDate >= todayKey).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const guides = pubRecent.filter((p) => p.type === 'guide').length;
  const commentary = pubRecent.length - guides;
  const unscheduled = state.pieces.filter((p) => p.status !== 'published' && !p.targetDate);

  // Month grid.
  const monthName = new Date(Date.UTC(y, m, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const startWeekday = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const chip = (p) => {
    const done = p.status === 'published';
    const cls = p.type === 'commentary' ? 'cal-chip commentary' : 'cal-chip';
    return `<a href="#/piece/${esc(p.id)}" class="${cls}${done ? ' done' : ''}" title="${esc(p.title || '(untitled)')} — ${done ? 'published' : STATUS_LABEL[p.status]}">${esc((p.title || 'Untitled').slice(0, 22))}</a>`;
  };

  $view.innerHTML = `
    <div class="row-between" style="align-items:flex-end">
      <div><h1>Calendar</h1><p class="subhead">Your publishing cadence at a glance. Set a <em>target publish date</em> on any piece (in its editor) and it appears here; published pieces show on the day they went live.</p></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn" data-cal="prev">←</button>
        <strong style="min-width:150px;text-align:center;font-family:var(--serif);font-size:16px">${esc(monthName)}</strong>
        <button class="btn" data-cal="next">→</button>
        <button class="btn" data-cal="today" style="font-size:11px">Today</button>
      </div>
    </div>

    <div class="bento" style="margin-bottom:14px">
      <div class="card tile b3" style="min-height:auto"><div class="tile-label">Published · 30 days</div><div class="tile-value" style="font-size:26px">${pubRecent.length}</div><div class="tile-note">${guides} guide · ${commentary} commentary</div></div>
      <div class="card tile b3" style="min-height:auto"><div class="tile-label">Scheduled ahead</div><div class="tile-value" style="font-size:26px">${upcoming.length}</div><div class="tile-note">with a target date</div></div>
      <div class="card tile b3" style="min-height:auto"><div class="tile-label">Unscheduled</div><div class="tile-value" style="font-size:26px">${unscheduled.length}</div><div class="tile-note">in progress, no date yet</div></div>
      <div class="card tile b3" style="min-height:auto"><div class="tile-label">Cadence target</div><div class="tile-value" style="font-size:26px">~1<span style="font-size:15px">/wk</span></div><div class="tile-note">a sustainable rhythm</div></div>
    </div>

    <div class="card">
      <div class="cal-grid cal-head">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}</div>
      <div class="cal-grid">
        ${cells.map((d) => {
          if (d === null) return '<div class="cal-cell empty-cell"></div>';
          const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const items = byDate[key] || [];
          return `<div class="cal-cell${key === todayKey ? ' today' : ''}"><div class="cal-date">${d}</div>${items.map(chip).join('')}</div>`;
        }).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:16px;font-size:11px;color:var(--ink-3)"><span><span class="cal-chip" style="display:inline-block">guide</span></span><span><span class="cal-chip commentary" style="display:inline-block">commentary</span></span><span>filled = published · outline = planned</span></div>
    </div>

    ${unscheduled.length ? `<div class="section-title">Unscheduled — in progress</div><div class="card">${unscheduled.map((p) => `<div class="row-between" style="padding:5px 0;border-bottom:1px solid var(--line)"><a href="#/piece/${esc(p.id)}"><strong style="font-size:13px">${esc(p.title || '(untitled)')}</strong></a><span class="badge">${esc(STATUS_LABEL[p.status])}</span></div>`).join('')}<p class="locked-note" style="margin-top:8px">Give each a target publish date in its editor to place it on the calendar.</p></div>` : ''}
  `;
}

function renderLibrary() {
  const pub = state.pieces.filter((p) => p.status === 'published').sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  $view.innerHTML = `
    <h1>Library</h1>
    <p class="subhead">Everything you've actually published, with the live links. This starts empty and grows only when you mark a piece published — it's your real body of work, not samples.</p>
    ${pub.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Published</th><th>Title</th><th>Type</th><th>Audience</th><th>Reviewer</th><th>Live on</th></tr></thead>
      <tbody>${pub.map((p) => `<tr>
        <td class="num">${day(p.publishedAt)}</td>
        <td><a href="#/piece/${esc(p.id)}"><strong>${esc(p.title || '(untitled)')}</strong></a></td>
        <td>${esc(TYPE_LABEL[p.type])}</td>
        <td>${esc(AUDIENCE_LABEL[p.audience])}</td>
        <td>${esc(p.reviewer || '—')}</td>
        <td>${p.channels.filter((c) => c.status === 'published').map((c) => c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(PLATFORMS[c.platform].label)}</a>` : esc(PLATFORMS[c.platform].label)).join(' · ') || '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
      : `<div class="card"><p class="empty">Nothing published yet. When you take a piece through review → approved → published (and paste its live URLs), it appears here.</p></div>`}
  `;
}

function renderSettings() {
  $view.innerHTML = `
    <h1>Settings</h1>
    <p class="subhead">Your details, so approvals and bylines are attributed to real people. Stored only in this browser.</p>
    <div class="card" style="max-width:520px" id="settings">
      <label class="fld"><span>Firm name</span><input type="text" data-s="firmName" value="${esc(state.settings.firmName)}" /></label>
      <label class="fld"><span>Your name (author / byline)</span><input type="text" data-s="authorName" value="${esc(state.settings.authorName)}" placeholder="e.g. your name" /></label>
      <label class="fld"><span>Default reviewer of record</span><input type="text" data-s="defaultReviewer" value="${esc(state.settings.defaultReviewer)}" placeholder="Attorney who signs off on legal content" /></label>
    </div>
    <div class="section-title">Data</div>
    <div class="card" style="max-width:520px">
      <p class="locked-note" style="margin-bottom:10px">Your content lives in this browser (localStorage) and persists across reloads and app updates. Export a backup, or reset to a clean slate.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="export">Export backup (JSON)</button>
        <button class="btn danger" id="reset">Reset all data</button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// Text inputs update state without re-rendering (preserve focus).
document.addEventListener('input', (ev) => {
  const t = ev.target;
  const pieceEl = t.closest('[data-piece]');
  if (pieceEl && t.dataset.f) { const p = getPiece(pieceEl.dataset.piece); if (p) { p[t.dataset.f] = t.value; save(); } return; }
  if (pieceEl && t.dataset.cf) { const p = getPiece(pieceEl.dataset.piece); const ci = Number(t.dataset.ci); if (p && p.channels[ci]) { p.channels[ci][t.dataset.cf] = t.value; save(); } return; }
  const devEl = t.closest('[data-dev]');
  if (devEl && t.dataset.df) { const d = state.developments.find((x) => x.id === devEl.dataset.dev); if (d) { d[t.dataset.df] = t.value; save(); } return; }
  const srcEl = t.closest('[data-src]');
  if (srcEl && t.dataset.sf) { const s = state.sources.find((x) => x.id === srcEl.dataset.src); if (s) { s[t.dataset.sf] = t.value; save(); } return; }
  if (t.id === 'strategy-notes') { state.strategyNotes = t.value; save(); return; }
  if (t.closest('#settings') && t.dataset.s) { state.settings[t.dataset.s] = t.value; save(); return; }
});

// Track select moves a development between groups → re-render.
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset.devtrack) { const d = state.developments.find((x) => x.id === t.dataset.devtrack); if (d) { d.track = t.value; save(); route(); } }
});

document.addEventListener('click', (ev) => {
  const cal = ev.target.closest('[data-cal]');
  if (cal) {
    const today = new Date();
    if (cal.dataset.cal === 'today') calCursor = { y: today.getUTCFullYear(), m: today.getUTCMonth() };
    else { let { y, m } = calCursor; m += cal.dataset.cal === 'next' ? 1 : -1; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } calCursor = { y, m }; }
    renderCalendar();
    return;
  }
  const el = ev.target.closest('[data-new],[data-open],[data-advance],[data-scaffold],[data-delete],[data-addchan],[data-rmchan],[data-togglechan],[data-adddev],[data-draftdev],[data-rmdev],[data-addsrc],[data-rmsrc],#export,#reset');
  if (!el) return;

  if (el.dataset.new) { const p = newPiece(el.dataset.new); location.hash = `#/piece/${p.id}`; return; }
  if (el.dataset.open) { location.hash = `#/piece/${el.dataset.open}`; return; }

  if (el.dataset.advance) {
    const p = getPiece(el.dataset.advance);
    if (p && advance(p, el.dataset.to)) { toast(`Moved to ${STATUS_LABEL[el.dataset.to]}.`); route(); }
    return;
  }
  if (el.dataset.scaffold) { const p = getPiece(el.dataset.scaffold); if (p) { p.body = scaffoldBody(p.type, p.audience, p.track); save(); route(); toast('Reset to a structured scaffold.'); } return; }
  if (el.dataset.delete) { const p = getPiece(el.dataset.delete); if (p && confirm('Delete this piece? This cannot be undone.')) { state.pieces = state.pieces.filter((x) => x.id !== p.id); save(); location.hash = '#/'; } return; }

  if (el.dataset.addchan) { const p = getPiece(el.dataset.addchan); if (p) { p.channels.push({ platform: el.dataset.pl, format: '', status: 'planned', url: '', publishedAt: null }); save(); route(); } return; }
  if (el.dataset.rmchan) { const p = getPiece(el.dataset.rmchan); if (p) { p.channels.splice(Number(el.dataset.ci), 1); save(); route(); } return; }
  if (el.dataset.togglechan) {
    const p = getPiece(el.dataset.togglechan); const c = p && p.channels[Number(el.dataset.ci)];
    if (c) { if (c.status === 'published') { c.status = 'planned'; c.publishedAt = null; } else { c.status = 'published'; c.publishedAt = nowISO(); } save(); route(); }
    return;
  }

  if (el.hasAttribute('data-adddev')) {
    const track = el.dataset.adddev || 'regulatory';
    state.developments.unshift({ id: uid('dev'), track, category: 'New', title: '', audience: 'founders', whyItMatters: '', sourceUrl: '', status: 'watching', noticedAt: nowISO(), relatedPieceId: null });
    save(); route(); return;
  }
  if (el.hasAttribute('data-addsrc')) { const tk = el.dataset.addsrc || 'general'; state.sources.push({ id: uid('src'), track: tk, label: '', note: '' }); save(); route(); return; }
  if (el.dataset.rmsrc) { state.sources = state.sources.filter((s) => s.id !== el.dataset.rmsrc); save(); route(); return; }
  if (el.dataset.draftdev) {
    const d = state.developments.find((x) => x.id === el.dataset.draftdev);
    if (d) {
      const p = newPiece('commentary', { audience: d.audience, topic: d.category, track: d.track || 'regulatory', sourceDevelopmentId: d.id });
      p.title = d.title ? `On: ${d.title}` : '';
      p.angle = `What this means for ${AUDIENCE_LABEL[d.audience] || 'clients'}`;
      d.relatedPieceId = p.id; d.status = 'commented'; save();
      location.hash = `#/piece/${p.id}`;
    }
    return;
  }
  if (el.dataset.rmdev) { state.developments = state.developments.filter((x) => x.id !== el.dataset.rmdev); save(); route(); return; }

  if (el.id === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kitsune-content-studio-backup.json'; a.click();
    toast('Backup exported.'); return;
  }
  if (el.id === 'reset') { if (confirm('Reset ALL Content Studio data in this browser? This cannot be undone.')) { state = freshState(); save(); location.hash = '#/'; route(); toast('Reset to a clean slate.'); } return; }
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function route() {
  const hash = location.hash || '#/';
  const [, page, arg] = hash.split('/');
  const navKey = page === 'piece' ? '' : page || 'pipeline';
  for (const a of $nav.querySelectorAll('a')) a.classList.toggle('active', a.dataset.route === (page || 'pipeline'));
  try {
    if (!page) renderPipeline();
    else if (page === 'piece') renderEditor(arg);
    else if (page === 'radar') renderRadar();
    else if (page === 'strategy') renderStrategy();
    else if (page === 'calendar') renderCalendar();
    else if (page === 'library') renderLibrary();
    else if (page === 'settings') renderSettings();
    else renderPipeline();
  } catch (err) {
    $view.innerHTML = `<p class="empty">Something went wrong: ${esc(err.message)}</p>`;
  }
}

window.addEventListener('hashchange', route);
route();
