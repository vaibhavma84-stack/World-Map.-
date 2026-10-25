// Learn: the rules of the road and the marks at sea, for revision on board.
// Lights and shapes (COLREGs Part C), sound signals (Part D), IALA buoyage
// (Regions A and B), MARPOL and ballast water in brief, and a quiz.
// A summary for study: the conventions themselves are the authority.

import { SOCIETIES, OTHER_SOCIETIES, SURVEYS, CLASS_NOTES, CERT_GROUPS, CERT_NOTES } from './learn-ship.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------- lights and shapes
// sig: all-round signal lights, top to bottom (R red, G green, W white,
// Y yellow, Yf flashing yellow); day: shapes, top to bottom.
export const VESSELS = [
  { n: 'Power-driven vessel underway, under 50 m', r: '23(a)', lights: 'Masthead light forward, sidelights and sternlight. A second masthead light abaft and higher is optional.', sig: [], day: [] },
  { n: 'Power-driven vessel underway, 50 m or more', r: '23(a)', lights: 'Two masthead lights, the after one higher; sidelights; sternlight.', sig: [], day: [] },
  { n: 'Air-cushion vessel in non-displacement mode', r: '23(b)', lights: 'Power-driven vessel’s lights plus an all-round flashing yellow light.', sig: ['Yf'], day: [] },
  { n: 'Sailing vessel underway', r: '25', lights: 'Sidelights and sternlight. May also show all-round red over green at or near the masthead.', sig: ['R', 'G'], day: [], dayNote: 'Under sail and engine: a cone, point down.', dayAlt: ['cone-down'] },
  { n: 'Towing, tow 200 m or less', r: '24(a)', lights: 'Two masthead lights in a vertical line, sidelights, sternlight, and a yellow towing light above the sternlight.', sig: ['W', 'W'], sigNote: 'masthead lights, seen from ahead', day: [] },
  { n: 'Towing, tow over 200 m', r: '24(a)', lights: 'Three masthead lights in a vertical line, sidelights, sternlight and towing light.', sig: ['W', 'W', 'W'], sigNote: 'masthead lights, seen from ahead', day: ['diamond'] },
  { n: 'Pushing ahead or towing alongside', r: '24(c)', lights: 'Two masthead lights in a vertical line, sidelights and sternlight (no towing light).', sig: ['W', 'W'], sigNote: 'masthead lights, seen from ahead', day: [] },
  { n: 'Vessel engaged in trawling', r: '26(b)', lights: 'All-round green over all-round white; a masthead light abaft and higher (required at 50 m or more). Sidelights and sternlight when making way.', sig: ['G', 'W'], day: ['cone-down', 'cone-up'], dayNote: 'Two cones, points together.' },
  { n: 'Vessel fishing (not trawling)', r: '26(c)', lights: 'All-round red over all-round white. Gear out more than 150 m: an all-round white light towards the gear. Sidelights and sternlight when making way.', sig: ['R', 'W'], day: ['cone-down', 'cone-up'], dayNote: 'Two cones, points together; gear out over 150 m: a cone point up towards it.' },
  { n: 'Vessel not under command', r: '27(a)', lights: 'Two all-round red lights in a vertical line. Sidelights and sternlight when making way.', sig: ['R', 'R'], day: ['ball', 'ball'] },
  { n: 'Vessel restricted in her ability to manoeuvre', r: '27(b)', lights: 'All-round red, white, red in a vertical line. Making way: plus masthead light(s), sidelights and sternlight. At anchor: plus anchor lights.', sig: ['R', 'W', 'R'], day: ['ball', 'diamond', 'ball'] },
  { n: 'Dredging or underwater work, with an obstruction', r: '27(d)', lights: 'Restricted-in-ability lights, plus two all-round red on the side of the obstruction and two all-round green on the side to pass.', sig: ['R', 'W', 'R'], day: ['ball', 'diamond', 'ball'], dayNote: 'Plus two balls on the obstructed side, two diamonds on the side to pass.' },
  { n: 'Small vessel with divers down', r: '27(e)', lights: 'Restricted-in-ability lights if practicable.', sig: ['R', 'W', 'R'], day: [], dayNote: 'A rigid replica of code flag A, at least 1 m high.' },
  { n: 'Vessel engaged in mine clearance', r: '27(f)', lights: 'Power-driven lights plus three all-round green lights: one near the foremast head and one at each end of the fore yard. Dangerous within 1000 m.', sig: ['G', 'G', 'G'], sigNote: 'one at the masthead, one at each yardarm', day: ['ball', 'ball', 'ball'], dayNote: 'Three balls, in the same places.' },
  { n: 'Vessel constrained by her draught', r: '28', lights: 'Power-driven lights; may also show three all-round red lights in a vertical line.', sig: ['R', 'R', 'R'], day: ['cylinder'] },
  { n: 'Pilot vessel on duty', r: '29', lights: 'All-round white over all-round red at or near the masthead. Underway: plus sidelights and sternlight. At anchor: plus anchor lights.', sig: ['W', 'R'], day: [], dayNote: 'Code flag H by day (by custom).' },
  { n: 'Vessel at anchor', r: '30(a)', lights: 'All-round white forward and a lower all-round white at or near the stern (under 50 m: one all-round white is enough). 100 m or more: deck lights on.', sig: ['W'], sigNote: 'forward; a lower one aft', day: ['ball'] },
  { n: 'Vessel aground', r: '30(d)', lights: 'Anchor lights plus two all-round red lights in a vertical line.', sig: ['R', 'R'], day: ['ball', 'ball', 'ball'] },
];

const LIGHT = { R: '#ff3b30', G: '#2ecc40', W: '#ffffff', Y: '#ffcc00', Yf: '#ffcc00' };
function lightsSvg(stack) {
  if (!stack.length) return '';
  const h = stack.length * 26 + 8;
  return `<svg class="learn-svg" viewBox="0 0 44 ${h}" width="44" height="${h}" aria-hidden="true"><rect width="44" height="${h}" rx="8" fill="#0d1b33"/>${stack.map((c, i) => `
    <circle cx="22" cy="${17 + i * 26}" r="9" fill="${LIGHT[c]}" opacity="0.25"/><circle cx="22" cy="${17 + i * 26}" r="5.5" fill="${LIGHT[c]}"/>${c === 'Yf' ? `<text x="35" y="${21 + i * 26}" font-size="9" fill="#ffcc00">fl</text>` : ''}`).join('')}</svg>`;
}
function shapeSvg(stack) {
  if (!stack.length) return '';
  const h = stack.length * 28 + 6;
  const draw = (s, y) => ({
    ball: `<circle cx="22" cy="${y + 12}" r="10"/>`,
    diamond: `<path d="M22 ${y} L34 ${y + 12} L22 ${y + 24} L10 ${y + 12} Z"/>`,
    'cone-up': `<path d="M22 ${y} L34 ${y + 22} L10 ${y + 22} Z"/>`,
    'cone-down': `<path d="M10 ${y + 2} L34 ${y + 2} L22 ${y + 24} Z"/>`,
    cylinder: `<rect x="13" y="${y}" width="18" height="24" rx="2"/>`,
  }[s]);
  return `<svg class="learn-svg" viewBox="0 0 44 ${h}" width="44" height="${h}" aria-hidden="true"><line x1="22" y1="0" x2="22" y2="${h}" stroke="#999" stroke-width="1"/><g fill="#111">${stack.map((s, i) => draw(s, 3 + i * 28)).join('')}</g></svg>`;
}

// --------------------------------------------------------------- sound signals
export const SOUNDS = [
  ['• (one short)', 'I am altering my course to starboard.', '34(a)'],
  ['• • (two short)', 'I am altering my course to port.', '34(a)'],
  ['• • • (three short)', 'I am operating astern propulsion.', '34(a)'],
  ['— — • (two long, one short)', 'In a narrow channel: I intend to overtake you on your starboard side.', '34(c)'],
  ['— — • • (two long, two short)', 'In a narrow channel: I intend to overtake you on your port side.', '34(c)'],
  ['— • — • (long, short, long, short)', 'Agreement by the vessel about to be overtaken.', '34(c)'],
  ['• • • • • (five or more short)', 'I do not understand your intentions, or doubt you are taking enough action.', '34(d)'],
  ['— (one long)', 'Nearing a bend or an area where other vessels may be hidden.', '34(e)'],
  ['— every 2 minutes (fog)', 'Power-driven vessel making way through the water.', '35(a)'],
  ['— — every 2 minutes (fog)', 'Power-driven vessel underway but stopped.', '35(b)'],
  ['— • • every 2 minutes (fog)', 'Not under command, restricted, constrained by draught, sailing, fishing, or towing/pushing.', '35(c)'],
  ['— • • • every 2 minutes (fog)', 'Vessel towed (the last one, if manned), right after the tug’s signal.', '35(e)'],
  ['Bell rung rapidly 5 s every minute (fog)', 'Vessel at anchor (100 m or more: and a gong aft). May add • — • to warn.', '35(g)'],
  ['3 strokes, rapid bell, 3 strokes (fog)', 'Vessel aground.', '35(h)'],
  ['• • • • (four short, fog)', 'Pilot vessel on duty (identity signal, may be sounded).', '35(k)'],
];

// -------------------------------------------------------------------- buoyage
// Colours top to bottom as bands; top: topmark.
export const MARKS = [
  { n: 'Port hand mark (Region A)', c: ['#d62828'], top: 'can-r', shape: 'can', light: 'Red, any rhythm except Fl(2+1).', note: 'Leave to port going in (with the direction of buoyage). In Region B this mark is green.' },
  { n: 'Starboard hand mark (Region A)', c: ['#1f9d55'], top: 'cone-g', shape: 'cone', light: 'Green, any rhythm except Fl(2+1).', note: 'Leave to starboard going in. In Region B this mark is red (“red right returning”).' },
  { n: 'Preferred channel to starboard (Region A)', c: ['#d62828', '#1f9d55', '#d62828'], top: 'can-r', shape: 'can', light: 'Fl(2+1) R.', note: 'A port mark with a broad green band: the main channel is to starboard.' },
  { n: 'Preferred channel to port (Region A)', c: ['#1f9d55', '#d62828', '#1f9d55'], top: 'cone-g', shape: 'cone', light: 'Fl(2+1) G.', note: 'A starboard mark with a broad red band: the main channel is to port.' },
  { n: 'North cardinal', c: ['#111', '#f2c200'], top: 'n', light: 'White VQ or Q (continuous).', note: 'Safe water to the north. Topmark: two cones, points up. Black above yellow.' },
  { n: 'East cardinal', c: ['#111', '#f2c200', '#111'], top: 'e', light: 'White VQ(3) 5s or Q(3) 10s.', note: 'Safe water to the east. Topmark: cones base to base (an egg). Black, yellow, black.' },
  { n: 'South cardinal', c: ['#f2c200', '#111'], top: 's', light: 'White VQ(6)+LFl 10s or Q(6)+LFl 15s.', note: 'Safe water to the south. Topmark: two cones, points down. Yellow above black.' },
  { n: 'West cardinal', c: ['#f2c200', '#111', '#f2c200'], top: 'w', light: 'White VQ(9) 10s or Q(9) 15s.', note: 'Safe water to the west. Topmark: cones point to point (a wineglass). Yellow, black, yellow.' },
  { n: 'Isolated danger mark', c: ['#111', '#d62828', '#111'], top: 'balls', light: 'White Fl(2).', note: 'On or over a danger of limited size with safe water all round.' },
  { n: 'Safe water mark', c: ['stripes-rw'], top: 'ball-r', light: 'White Iso, Oc, LFl 10s or Mo(A).', note: 'Safe water all round: mid-channel or landfall.' },
  { n: 'Special mark', c: ['#f2c200'], top: 'x', light: 'Yellow, any rhythm not used for other marks.', note: 'Not for navigation as such: spoil grounds, cables, outfalls, recreation zones, traffic separation where confusing.' },
  { n: 'Emergency wreck marking buoy', c: ['stripes-by'], top: 'cross', light: 'Alternating blue and yellow flashes.', note: 'A new danger not yet on the charts.' },
];
function markSvg(m) {
  const W = 70, H = 120;
  const body = m.shape === 'can' ? 'M20 46 H50 V104 H20 Z' : m.shape === 'cone' ? 'M35 42 L52 104 H18 Z' : 'M24 44 H46 L50 104 H20 Z';
  const bands = m.c.length;
  let fill = '';
  if (m.c[0] === 'stripes-rw' || m.c[0] === 'stripes-by') {
    const [a, b] = m.c[0] === 'stripes-rw' ? ['#d62828', '#fff'] : ['#1d4ed8', '#f2c200'];
    for (let i = 0; i < 6; i++) fill += `<rect x="${16 + i * 6.5}" y="40" width="6.5" height="66" fill="${i % 2 ? b : a}"/>`;
  } else {
    m.c.forEach((c, i) => { fill += `<rect x="10" y="${42 + i * (62 / bands)}" width="50" height="${62 / bands + 0.5}" fill="${c}"/>`; });
  }
  const cone = (y, up, col = '#111') => (up ? `<path d="M35 ${y} L43 ${y + 12} L27 ${y + 12} Z" fill="${col}"/>` : `<path d="M27 ${y} L43 ${y} L35 ${y + 12} Z" fill="${col}"/>`);
  const top = {
    'can-r': '<rect x="28" y="20" width="14" height="14" fill="#d62828"/>',
    'cone-g': cone(20, true, '#1f9d55'),
    n: cone(6, true) + cone(21, true),
    s: cone(6, false) + cone(21, false),
    e: cone(6, true) + cone(21, false),
    w: cone(6, false) + cone(21, true),
    balls: '<circle cx="35" cy="12" r="6" fill="#111"/><circle cx="35" cy="27" r="6" fill="#111"/>',
    'ball-r': '<circle cx="35" cy="24" r="7.5" fill="#d62828"/>',
    x: '<path d="M28 16 L42 32 M42 16 L28 32" stroke="#f2c200" stroke-width="4"/>',
    cross: '<path d="M35 14 V34 M27 22 H43" stroke="#f2c200" stroke-width="4"/>',
  }[m.top];
  return `<svg class="learn-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <defs><clipPath id="b${esc(m.n.replace(/\W/g, ''))}"><path d="${body}"/></clipPath></defs>
    <line x1="35" y1="34" x2="35" y2="44" stroke="#333" stroke-width="2"/>${top}
    <g clip-path="url(#b${esc(m.n.replace(/\W/g, ''))})">${fill}</g><path d="${body}" fill="none" stroke="#333" stroke-width="1.5"/>
    <path d="M8 108 Q20 104 35 108 T62 108" stroke="#5aa0d8" stroke-width="2.5" fill="none"/></svg>`;
}

// Countries in IALA Region B: the Americas, Japan, the Koreas, the Philippines.
const REGION_B_OTHER = new Set(['JP', 'KR', 'KP', 'PH']);
const AMERICAS = new Set('AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI'.split(' '));
export const ialaRegion = (cc) => (AMERICAS.has(cc) || REGION_B_OTHER.has(cc) ? 'B' : 'A');

// ------------------------------------------------------------- MARPOL in brief
const MARPOL = [
  ['Annex VI: sulphur', 'Fuel sulphur at most 0.50% outside emission control areas (since 2020); 0.10% inside a SOx ECA: Baltic, North Sea, North American, US Caribbean and, from 1 May 2025, the Mediterranean. (EU ports also require 0.10% at berth for more than two hours: an EU rule.)'],
  ['Annex VI: NOx Tier III', 'In NOx ECAs for engines on ships built on or after 1 January 2016 (North American and US Caribbean) or 1 January 2021 (Baltic and North Sea).'],
  ['Annex I: machinery space oil', 'Only en route, oil content 15 ppm or less, through approved filtering equipment; in special areas also with an alarm and automatic stop. Never in the Antarctic area.'],
  ['Annex I: tanker cargo area', 'Outside special areas only: more than 50 nm from land, en route, at most 30 litres per nautical mile, total at most 1/30,000 of the last cargo, with the oil discharge monitor working. Not in special areas.'],
  ['Annex II: noxious liquids', 'Categories X, Y and Z residues: en route at 7 knots or more, 12 nm or more from land, in 25 m of water or more, below the waterline (and as the procedures manual says).'],
  ['Annex IV: sewage', 'Comminuted and disinfected: 3 nm or more from land. Untreated: 12 nm or more, en route at 4 knots or more, at a moderate rate. An approved treatment plant: anywhere (stricter for passenger ships in the Baltic).'],
  ['Annex V: garbage', 'Plastics never. Food waste: 12 nm or more, or 3 nm if ground to 25 mm or less (in special areas 12 nm and ground only). Cargo residues not harmful: 12 nm or more. Always en route.'],
  ['Ballast water (BWM Convention)', 'D-2 standard by an approved treatment system. Where exchange (D-1) still applies: 200 nm from land in 200 m of water, or at least 50 nm in 200 m of water.'],
];

// ------------------------------------------------------------------------ quiz
function question() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const kind = pick(['lights', 'lights', 'sound', 'mark']);
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  if (kind === 'sound') {
    const answer = pick(SOUNDS);
    const others = shuffle(SOUNDS.filter((s) => s !== answer)).slice(0, 3);
    return { q: `What does this sound signal mean?<br><b class="big">${esc(answer[0])}</b>`, a: answer[1], options: shuffle([answer, ...others].map((s) => s[1])), why: `Rule ${answer[2]}.` };
  }
  if (kind === 'mark') {
    const answer = pick(MARKS);
    const others = shuffle(MARKS.filter((s) => s !== answer)).slice(0, 3);
    return { q: `Which mark is this?<div class="quiz-pic">${markSvg(answer)}</div><small>Light: ${esc(answer.light)}</small>`, a: answer.n, options: shuffle([answer, ...others].map((s) => s.n)), why: answer.note };
  }
  const withSig = VESSELS.filter((v) => v.sig.length || v.day.length);
  const answer = pick(withSig);
  const byDay = answer.day.length && Math.random() < 0.4;
  const others = shuffle(VESSELS.filter((v) => v !== answer)).slice(0, 3);
  return {
    q: byDay ? `By day you see these shapes. What is she?<div class="quiz-pic">${shapeSvg(answer.day)}</div>` : `At night you see these all-round lights (with whatever else she shows). What is she?<div class="quiz-pic">${lightsSvg(answer.sig)}</div>${answer.sigNote ? `<small>${esc(answer.sigNote)}</small>` : ''}`,
    a: answer.n, options: shuffle([answer, ...others].map((v) => v.n)), why: `Rule ${answer.r}: ${answer.lights}`,
  };
}

export function openLearn({ openPanel, tab: first }) {
  let tab = first || 'lights';
  let score = 0, asked = 0;
  const tabs = [['lights', 'Lights & shapes'], ['sound', 'Sound signals'], ['buoys', 'Buoyage'], ['marpol', 'MARPOL'], ['class', 'Class'], ['certs', 'Certificates'], ['quiz', 'Quiz']];
  const body = () => {
    if (tab === 'lights') {
      return VESSELS.map((v) => `<div class="card learn-card"><div class="learn-pics">${lightsSvg(v.sig)}${shapeSvg(v.day.length ? v.day : v.dayAlt || [])}</div>
        <div><h3>${esc(v.n)} <small>Rule ${esc(v.r)}</small></h3><p>${esc(v.lights)}</p>${v.sigNote ? `<div class="note">Lights drawn: ${esc(v.sigNote)}.</div>` : ''}${v.day.length || v.dayNote ? `<div class="note">By day: ${esc(v.dayNote || 'the shapes drawn.')}</div>` : '<div class="note">By day: no shape.</div>'}</div></div>`).join('');
    }
    if (tab === 'sound') {
      return `<div class="card"><table class="facts learn-table">${SOUNDS.map(([s, m, r]) => `<tr><th>${esc(s)}</th><td>${esc(m)} <small>${esc(r)}</small></td></tr>`).join('')}</table>
        <div class="note">• short blast about 1 second; — prolonged blast 4 to 6 seconds.</div></div>`;
    }
    if (tab === 'buoys') {
      return `<div class="card"><p><b>Region A</b>: Europe, Africa, Asia (except Japan, Korea and the Philippines), Australia. <b>Region B</b>: the Americas, Japan, Korea and the Philippines, where port and starboard colours are the other way round. A country’s card on the map says which region it uses.</p></div>
        ${MARKS.map((m) => `<div class="card learn-card"><div class="learn-pics">${markSvg(m)}</div><div><h3>${esc(m.n)}</h3><p>${esc(m.note)}</p><div class="note">Light: ${esc(m.light)}</div></div></div>`).join('')}`;
    }
    if (tab === 'class') {
      return `<div class="card"><h3>IACS members</h3><table class="facts learn-table cls"><tr><th>Society</th><th>Country</th><th>Since</th></tr>
        ${SOCIETIES.map(([n, a, c, y, note]) => `<tr><td><b>${esc(a)}</b> ${esc(n)}<div class="note">${esc(note)}</div></td><td>${esc(c)}</td><td>${y}</td></tr>`).join('')}</table></div>
        <div class="card"><h3>Other societies</h3><table class="facts learn-table cls">${OTHER_SOCIETIES.map(([n, a, c, note]) => `<tr><td><b>${esc(a)}</b> ${esc(n)}${note ? `<div class="note">${esc(note)}</div>` : ''}</td><td>${esc(c)}</td></tr>`).join('')}</table>
        <div class="note">Not members of IACS; some flags accept them as Recognised Organisations.</div></div>
        <div class="card"><h3>Class surveys</h3>${SURVEYS.map(([n, when, what]) => `<div class="cert"><b>${esc(n)}</b><div class="cert-valid">${esc(when)}</div><div>${esc(what)}</div></div>`).join('')}</div>
        <div class="card"><h3>Good to know</h3><ul class="learn-list">${CLASS_NOTES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    }
    if (tab === 'certs') {
      return `<div class="card"><p>Certificates and documents of a <b>UK-flag ship</b> (Maritime and Coastguard Agency, MCA): what each is for, how long it is valid and who issues it. For study, not a checklist.</p></div>
        ${CERT_GROUPS.map(([group, list]) => `<div class="card"><h3>${esc(group)}</h3>${list.map(([n, valid, by, note]) => `<div class="cert"><b>${esc(n)}</b>
          <div class="cert-valid">Validity: ${esc(valid)}</div><div class="cert-by">Issued by: ${esc(by)}</div><div>${esc(note)}</div></div>`).join('')}</div>`).join('')}
        <div class="card"><h3>Good to know</h3><ul class="learn-list">${CERT_NOTES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    }
    if (tab === 'marpol') {
      return `${MARPOL.map(([h, t]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join('')}
        <div class="note">In brief, for revision. Tap the sea on the map to see the ECA, special area and load line zone there. The conventions and flag state rules are the authority.</div>`;
    }
    const q = question();
    return `<div class="card quiz" data-a="${esc(q.a)}"><p>${q.q}</p>
      <div class="quiz-options">${q.options.map((o) => `<button type="button" class="secondary" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      <div class="note quiz-why" hidden>${esc(q.why)}</div>
      <div class="row-end"><span class="note">Score ${score} / ${asked}</span><button type="button" class="primary" id="quiz-next" hidden>Next question</button></div></div>`;
  };
  const render = () => {
    openPanel(`<h1>Learn</h1><p class="sub">Rules of the road, buoyage, MARPOL, class and certificates, for revision.</p>
      <div class="sky-views learn-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="cards">${body()}</div>`);
    for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => { tab = b.dataset.tab; render(); };
    const quiz = document.querySelector('.quiz');
    if (quiz) {
      for (const b of quiz.querySelectorAll('[data-o]')) {
        b.onclick = () => {
          if (quiz.dataset.done) return;
          quiz.dataset.done = 1;
          asked++;
          const right = b.dataset.o === quiz.dataset.a;
          if (right) score++;
          for (const o of quiz.querySelectorAll('[data-o]')) {
            if (o.dataset.o === quiz.dataset.a) o.classList.add('right');
            else if (o === b) o.classList.add('wrong');
          }
          quiz.querySelector('.quiz-why').hidden = false;
          quiz.querySelector('.row-end .note').textContent = `${right ? 'Right! ' : ''}Score ${score} / ${asked}`;
          document.getElementById('quiz-next').hidden = false;
        };
      }
      document.getElementById('quiz-next').onclick = render;
    }
  };
  render();
}
