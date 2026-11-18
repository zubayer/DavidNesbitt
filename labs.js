(() => {
  'use strict';

  const color = { plum: '#d6bbf0', peach: '#ffae83', pale: '#fff1db', muted: '#c6bdcc', grid: '#514550' };
  const hcOverK = 1.438776877; // Kelvin per inverse centimetre.
  const instances = new WeakMap();
  let count = 0;

  function safe(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function line(x1, y1, x2, y2, stroke, attrs = '') {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" ${attrs}/>`;
  }

  function label(x, y, content, anchor = 'middle', attrs = '') {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" ${attrs}>${safe(content)}</text>`;
  }

  function ticks(min, max, count) {
    const rough = (max - min) / count;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].map(n => n * magnitude).reduce((a, b) => Math.abs(a - rough) <= Math.abs(b - rough) ? a : b);
    const first = Math.ceil(min / step - 1e-9) * step;
    const values = [];
    for (let i = 0; first + i * step <= max + step / 10000; i++) values.push(Number((first + i * step).toPrecision(12)));
    return values;
  }

  function frame(width, options) {
    const w = Math.max(280, Math.min(1050, Math.round(width || 640)));
    const h = w < 450 ? 230 : 258;
    const left = w < 400 ? 38 : 48, right = w - 22, top = 36, bottom = h - 46;
    const { xmin, xmax, ymin, ymax } = options;
    const x = value => left + (value - xmin) / (xmax - xmin) * (right - left);
    const y = value => bottom - (value - ymin) / (ymax - ymin) * (bottom - top);
    const xTicks = options.xTicks || ticks(xmin, xmax, w < 420 ? 3 : w < 700 ? 5 : 7);
    const yTicks = options.yTicks || ticks(ymin, ymax, 4);
    let axes = label(left, 18, options.yLabel, 'start', 'class="nl-unit"');
    for (const v of yTicks) {
      axes += line(left, y(v), right, y(v), color.grid, 'stroke-width="0.8" stroke-dasharray="2 4"');
      axes += label(left - 7, y(v) + 4, options.yFormat ? options.yFormat(v) : v, 'end', 'class="nl-tick"');
    }
    for (const v of xTicks) {
      axes += line(x(v), bottom, x(v), bottom + 4, color.muted);
      axes += label(x(v), bottom + 18, options.xFormat ? options.xFormat(v) : v, 'middle', 'class="nl-tick"');
    }
    axes += line(left, bottom, right, bottom, color.muted, 'stroke-width="1"');
    axes += label((left + right) / 2, h - 5, options.xLabel, 'middle', 'class="nl-unit"');
    return { w, h, x, y, left, right, top, bottom, axes };
  }

  function svg(frame, title, drawing) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.w} ${frame.h}" role="img" aria-label="${safe(title)}"><title>${safe(title)}</title>${frame.axes}${drawing}</svg>`;
  }

  function path(points, stroke, style = '') {
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-linejoin="round" stroke-linecap="round" ${style}/>`;
  }

  function legend(items) {
    return `<div class="nl-legend">${items.map(([text, type]) => `<span><i class="nl-key nl-key-${type}" aria-hidden="true"></i>${safe(text)}</span>`).join('')}</div>`;
  }

  function readings(items) {
    return items.map(([name, value]) => `<div><dt>${safe(name)}</dt><dd>${safe(value)}</dd></div>`).join('');
  }

  function table(headers, rows, caption) {
    return `<div class="nl-tablescroll" tabindex="0" role="region" aria-label="${safe(caption)}"><table><caption>${safe(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${safe(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((a, i) => i === 0 ? `<th scope="row">${safe(a)}</th>` : `<td>${safe(a)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function slider(key, title, min, max, step, value, format) {
    return { type: 'range', key, title, min, max, step, value, format };
  }

  function choice(key, title, items, value) {
    return { type: 'select', key, title, items, value };
  }

  function control(c, unique) {
    const id = `${unique}-${c.key}`;
    if (c.type === 'select') return `<div class="nl-control"><label for="${id}">${safe(c.title)}</label><select id="${id}" data-control="${c.key}">${c.items.map(([v, t]) => `<option value="${safe(v)}" ${String(c.value) === String(v) ? 'selected' : ''}>${safe(t)}</option>`).join('')}</select></div>`;
    return `<div class="nl-control"><div class="nl-controltop"><label for="${id}">${safe(c.title)}</label><output for="${id}" data-value="${c.key}" aria-live="off">${safe(c.format(c.value))}</output></div><input id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" data-control="${c.key}"></div>`;
  }

  const refs = {
    ir: [
      ['MIT · Vibrational–rotational spectra', 'https://web.mit.edu/5.33/www/lec/spec5.pdf'],
      ['Fárník, Davis & Nesbitt · HCl clusters', 'https://doi.org/10.1039/B009808F']
    ],
    dynamics: [
      ['Perkins & Nesbitt · State-resolved CO₂ scattering', 'https://doi.org/10.1021/jp0709048'],
      ['NIST CCCBDB · CO₂ rotational constant', 'https://cccbdb.nist.gov/exp2x.asp?casno=124389&charge=0']
    ],
    rna: [
      ['Hodak et al. · Single-molecule RNA docking', 'https://doi.org/10.1073/pnas.0408645102'],
      ['Fiore · Distance–efficiency relation (§1.5)', 'https://jila.colorado.edu/sites/default/files/2019-04/fiore_thesis_jila.pdf']
    ],
    nano: [
      ['Kuno et al. · Quantum-dot intermittency', 'https://doi.org/10.1063/1.1377883'],
      ['NIST · Distributed blinking kinetics', 'https://www.nist.gov/publications/modeling-distributed-kinetics-isolated-semiconductor-quantum-dots-0']
    ]
  };

  const jMax = 9;
  const transitionKeys = [];
  for (let j = jMax; j >= 1; j--) transitionKeys.push([`P${j}`, `P(${j})`]);
  for (let j = 0; j <= jMax; j++) transitionKeys.push([`R${j}`, `R(${j})`]);

  const infrared = {
    title: 'Build a rovibrational band',
    intro: 'Move a rotational constant or cool the molecular beam. Select a stick to see the quantum states behind a line.',
    controls: [
      slider('lower', 'Ground-state B″', 0.10, 0.50, 0.005, 0.240, v => `${v.toFixed(3)} cm⁻¹`),
      slider('ratio', 'Upper-state B′ / B″', 0.96, 1.04, 0.001, 0.990, v => v.toFixed(3)),
      slider('temperature', 'Rotational temperature', 1, 12, 0.25, 3, v => `${Number(v.toFixed(2))} K`),
      choice('selected', 'Inspect a transition', transitionKeys, 'R0')
    ],
    legend: [['P branch · ΔJ = −1', 'plum'], ['R branch · ΔJ = +1', 'peach'], ['Band origin', 'dash']],
    tryIt: 'Change B′/B″ while watching R(0) − P(2). Both transitions end at J′ = 1, so the upper-state energy cancels. The difference measures 6B″ in this model.',
    model: 'A linear, closed-shell Σ–Σ parallel fundamental uses ν̃ = ν̃₀ + B′J′(J′+1) − B″J″(J″+1), with ν̃₀ fixed at 2900 cm⁻¹. Stick heights scale as J″ for P or J″+1 for R, multiplied by exp[−hcB″J″(J″+1)/kT]. Each display is normalized to its strongest line. The line list stops at J″ = 9. The example omits linewidth, hyperfine structure and centrifugal distortion. Applying this to an asymmetric trimer requires its additional rotational quantum numbers.',
    dataLabel: 'Inspect the calculated line list',
    render(s, width) {
      const upper = s.lower * s.ratio;
      const lines = transitionKeys.map(([key, name]) => {
        const j = Number(key.slice(1)), r = key[0] === 'R', jp = j + (r ? 1 : -1);
        const pos = 2900 + upper * jp * (jp + 1) - s.lower * j * (j + 1);
        const intensity = (r ? j + 1 : j) * Math.exp(-hcOverK * s.lower * j * (j + 1) / s.temperature);
        return { key, name, j, jp, pos, intensity, r };
      });
      const strongest = Math.max(...lines.map(a => a.intensity));
      lines.forEach(a => { a.intensity /= strongest; });
      const min = Math.min(...lines.map(a => a.pos)), max = Math.max(...lines.map(a => a.pos)), pad = (max - min) * 0.055;
      const f = frame(width, { xmin: min - pad, xmax: max + pad, ymin: 0, ymax: 1.12, xLabel: 'Wavenumber (cm⁻¹)', yLabel: 'Relative line strength', yTicks: [0, 0.5, 1], xFormat: v => Number(v.toFixed(2)) });
      const x0 = f.x(2900);
      let drawing = line(x0, f.top, x0, f.bottom, color.muted, 'stroke-dasharray="4 4"');
      const selected = lines.find(a => a.key === s.selected) || lines[9];
      for (const a of lines) {
        const x = f.x(a.pos), y = f.y(a.intensity), c = a.r ? color.peach : color.plum;
        drawing += `<g data-stick="${a.key}"><title>${a.name}, ${a.pos.toFixed(4)} cm⁻¹</title>${line(x, f.bottom, x, y, c, 'stroke-width="2.5"')}${line(x, f.bottom, x, Math.min(y, f.bottom - 16), 'transparent', 'stroke-width="11" class="nl-stick-hit"')}</g>`;
      }
      const selectedX = f.x(selected.pos), selectedY = f.y(selected.intensity);
      drawing += `<circle cx="${selectedX}" cy="${selectedY}" r="4" stroke="${color.pale}" stroke-width="1.8" fill="${selected.r ? color.peach : color.plum}" pointer-events="none"/>`;
      drawing += label(selectedX, selectedY - 10, selected.name, 'middle', 'class="nl-active" pointer-events="none"');
      const diff = lines.find(a => a.key === 'R0').pos - lines.find(a => a.key === 'P2').pos;
      return {
        graph: svg(f, `Simulated linear-rotor absorption band. ${selected.name} is at ${selected.pos.toFixed(4)} inverse centimetres.`, drawing),
        values: [[`${selected.name} position`, `${selected.pos.toFixed(4)} cm⁻¹`], ['Lower → upper J', `${selected.j} → ${selected.jp}`], ['R(0) − P(2)', `${diff.toFixed(4)} cm⁻¹`]],
        explanation: `At ${s.temperature} K, ${lines.reduce((a, b) => a.intensity >= b.intensity ? a : b).name} is strongest among the displayed lines. B′ is ${upper.toFixed(4)} cm⁻¹. The dashed line is the energy difference between the two vibrational origins.`,
        data: () => table(['Line', 'J″ → J′', 'Wavenumber (cm⁻¹)', 'Relative strength'], lines.map(a => [a.name, `${a.j} → ${a.jp}`, a.pos.toFixed(4), a.intensity < 0.0001 ? '<0.0001' : a.intensity.toFixed(4)]), 'Calculated transitions in order of branch and lower-state J')
      };
    }
  };

  function rotorPopulation(temperature) {
    const rows = [];
    let total = 0;
    for (let j = 0; j <= 320; j += 2) {
      const energyK = hcOverK * 0.39021 * j * (j + 1);
      const weight = (2 * j + 1) * Math.exp(-energyK / temperature);
      rows.push({ j, energyK, p: weight });
      total += weight;
    }
    rows.forEach(row => { row.p /= total; });
    return rows;
  }

  const dynamics = {
    title: 'Separate two scattering channels',
    intro: 'A beam of CO₂ strikes a liquid. Mix a near-surface-temperature rotational distribution with a hotter impulsive component and examine the outgoing molecules.',
    controls: [
      slider('fraction', 'Impulsive share', 0, 100, 1, 35, v => `${v}%`),
      slider('surface', 'Surface temperature', 220, 360, 5, 290, v => `${v} K`),
      slider('hot', 'Impulsive rotational temperature', 400, 1000, 10, 700, v => `${v} K`),
      choice('view', 'Plot coordinates', [['pop', 'Rotational populations'], ['log', 'Boltzmann plot']], 'pop')
    ],
    legend: [['Near-surface T', 'plumdash'], ['Impulsive', 'peachdash'], ['Mixture', 'pale']],
    tryIt: 'Switch to the Boltzmann plot. Compare 0%, 35% and 100% impulsive share. Each individual component gives one straight line. A mixture can bend as the hotter contribution takes over at high rotational energy.',
    model: 'Each reference distribution uses p(J) ∝ (2J+1) exp[−Eⱼ/kT], with Eⱼ/k = (hc/k)BJ(J+1) and B = 0.39021 cm⁻¹. Ground-vibrational-state ¹²C¹⁶O₂ admits even J. Each component is normalized through J = 320. The displayed mixture is (1−f)pₛ + f pᵢ. The temperatures and share are teaching inputs. The source paper measured internal populations and translational distributions of scattered CO₂. A two-component fit can describe observations, while angle and velocity measurements help test the channel interpretation.',
    dataLabel: 'Inspect the modeled populations',
    render(s, width) {
      const cold = rotorPopulation(s.surface), hot = rotorPopulation(s.hot), frac = s.fraction / 100;
      const rows = cold.map((r, i) => ({ ...r, cold: r.p, hot: hot[i].p, mix: (1 - frac) * r.p + frac * hot[i].p }));
      const shown = rows.filter(r => r.j <= 90);
      const log = s.view === 'log';
      const vertical = (r, key) => log ? Math.log(r[key] / (2 * r.j + 1)) : 100 * r[key];
      const xy = r => log ? r.energyK : r.j;
      const vals = shown.flatMap(r => [vertical(r, 'cold'), vertical(r, 'hot')]);
      const f = frame(width, { xmin: 0, xmax: xy(shown[shown.length - 1]), ymin: log ? Math.floor(Math.min(...vals)) - 0.15 : 0, ymax: log ? Math.ceil(Math.max(...vals)) : Math.ceil(Math.max(...vals) * 1.04), xLabel: log ? 'Rotational energy Eⱼ/k (K)' : 'Rotational quantum number J', yLabel: log ? 'ln[p(J) / (2J+1)]' : 'Population at each even J (%)' });
      const c = (k, ink, attr) => path(shown.map(row => [f.x(xy(row)), f.y(vertical(row, k))]), ink, attr);
      const drawing = c('cold', color.plum, 'stroke-width="2" stroke-dasharray="5 5"') + c('hot', color.peach, 'stroke-width="2" stroke-dasharray="2 4"') + c('mix', color.pale, 'stroke-width="2.8"');
      const highJ = 100 * rows.filter(r => r.j >= 40).reduce((sum, r) => sum + r.mix, 0);
      const meanEnergy = rows.reduce((sum, r) => sum + r.mix * r.energyK, 0);
      const mode = rows.reduce((a, b) => a.mix >= b.mix ? a : b).j;
      return {
        graph: svg(f, `Reference and mixed rotational distributions at a ${s.fraction}% impulsive share. ${highJ.toFixed(1)} percent of the mixture occupies J 40 or above.`, drawing),
        values: [['Most populated J', mode], ['Population at J ≥ 40', `${highJ.toFixed(1)}%`], ['Mean Eᵣₒₜ / k', `${meanEnergy.toFixed(1)} K`]],
        explanation: `The mixture contains ${100 - s.fraction}% of the ${s.surface} K reference and ${s.fraction}% of the ${s.hot} K reference. Each dashed curve shows a pure component. The solid curve gives the sampled mixture.`,
        data: () => table(['J', 'Eⱼ/k (K)', 'Near-surface (%)', 'Impulsive (%)', 'Mixture (%)'], shown.map(r => [r.j, r.energyK.toFixed(1), (100 * r.cold).toFixed(3), (100 * r.hot).toFixed(3), (100 * r.mix).toFixed(3)]), 'Calculated ground-vibrational-state CO₂ populations through J = 90')
      };
    }
  };

  const efficiency = (r, r0) => 1 / (1 + (r / r0) ** 6);
  const fret = {
    title: 'Measure a distance with FRET',
    intro: 'Move two fluorescent labels closer together. Follow the marker to see how the distance between dyes changes the probability of energy transfer.',
    controls: [
      slider('distance', 'Donor–acceptor distance r', 2, 11, 0.1, 5.5, v => `${v.toFixed(1)} nm`),
      slider('radius', 'Förster radius R₀', 4, 7, 0.1, 5.5, v => `${v.toFixed(1)} nm`)
    ],
    action: ['midpoint', 'Set r = R₀'],
    legend: [['Efficiency curve', 'plum'], ['Selected distance', 'dot']],
    tryIt: 'Set r = R₀, then move the labels one nanometre apart from that position. The curve is steep near R₀. Near its upper and lower plateaus, a similar distance change produces a smaller change in efficiency.',
    model: 'For a single donor–acceptor pair at fixed separation, E = 1 / [1 + (r/R₀)⁶]. R₀ summarizes the dye pair, spectral overlap, donor quantum yield, orientation factor and refractive index. An efficiency state reports on label separation. RNA structure interpretation also requires the labeling geometry, controls for dye photophysics and corrected donor/acceptor signals. The curve models a static pair and contains no residence-time or folding-rate data.',
    dataLabel: 'Inspect the distance–efficiency curve',
    render(s, width) {
      const E = efficiency(s.distance, s.radius);
      const f = frame(width, { xmin: 2, xmax: 11, ymin: 0, ymax: 1, xLabel: 'Dye separation r (nm)', yLabel: 'Transfer efficiency E', yTicks: [0, 0.25, 0.5, 0.75, 1] });
      const coords = Array.from({length: 181}, (_, i) => { const d = 2 + i / 20; return [f.x(d), f.y(efficiency(d, s.radius))]; });
      const px = f.x(s.distance), py = f.y(E);
      let drawing = line(f.x(s.radius), f.top, f.x(s.radius), f.bottom, color.muted, 'stroke-dasharray="3 5"');
      drawing += path(coords, color.plum, 'stroke-width="3"');
      drawing += line(px, py, px, f.bottom, color.peach, 'stroke-dasharray="4 5"') + line(f.left, py, px, py, color.peach, 'stroke-dasharray="4 5"');
      drawing += `<circle cx="${px}" cy="${py}" r="5.5" fill="${color.peach}" stroke="${color.pale}" stroke-width="1.6"/>`;
      drawing += label(f.x(s.radius) + 5, f.top + 12, 'R₀', 'start', 'class="nl-unit"');
      const percent = (100 * E).toFixed(1);
      return {
        graph: svg(f, `At a separation of ${s.distance} nanometres and Förster radius ${s.radius} nanometres, the modeled transfer efficiency is ${percent} percent.`, drawing),
        values: [['Transfer probability', `${percent}%`], ['Distance / R₀', (s.distance / s.radius).toFixed(2)], ['Local slope dE/dr', `${(-6 * E * (1 - E) / s.distance).toFixed(3)} nm⁻¹`]],
        explanation: `At this distance, about ${Math.round(100 * E)} of 100 donor excitations would transfer energy to the acceptor on average. The slope gives the local change in efficiency per nanometre.`,
        data: () => table(['Separation (nm)', 'Transfer efficiency', 'Probability (%)'], Array.from({length: 19}, (_, i) => { const d = 2 + i * 0.5, e = efficiency(d, s.radius); return [d.toFixed(1), e.toFixed(4), (100 * e).toFixed(2)]; }), `Model sampled every 0.5 nm for R₀ = ${s.radius.toFixed(1)} nm`)
      };
    }
  };

  function randomGenerator(seed) {
    let x = seed >>> 0;
    return () => {
      x = (Math.imul(1664525, x) + 1013904223) >>> 0;
      return (x + 0.5) / 4294967296;
    };
  }

  const traceDuration = 16;
  function dwellTimes(exponent, seed) {
    const rand = randomGenerator(seed), min = 0.035, max = 3.5, pow = 1 - exponent;
    const lower = min ** pow, upper = max ** pow;
    const intervals = [];
    let time = 0, bright = true;
    while (time < traceDuration) {
      const dwell = (lower + rand() * (upper - lower)) ** (1 / pow);
      const end = Math.min(traceDuration, time + dwell);
      intervals.push({ start: time, end, bright });
      time = end;
      bright = !bright;
    }
    return intervals;
  }

  function binTrace(intervals, width) {
    const bins = [];
    const n = Math.round(traceDuration / width);
    let cursor = 0;
    for (let i = 0; i < n; i++) {
      const lo = i * width, hi = (i + 1) * width;
      while (cursor < intervals.length - 1 && intervals[cursor].end <= lo) cursor++;
      let brightTime = 0;
      for (let k = cursor; k < intervals.length && intervals[k].start < hi; k++) {
        if (intervals[k].bright) brightTime += Math.max(0, Math.min(hi, intervals[k].end) - Math.max(lo, intervals[k].start));
      }
      bins.push({ lo, hi, intensity: Math.max(0, Math.min(1, brightTime / width)) });
    }
    return bins;
  }

  function stepPoints(rows, f, valueKey) {
    return rows.flatMap(([lo, hi, val]) => [[f.x(lo), f.y(valueKey(val))], [f.x(hi), f.y(valueKey(val))]]);
  }

  const blinking = {
    title: 'Resolve a blinking quantum dot',
    intro: 'A simulated dot stays illuminated while its emission switches between bright and dark. Change the detector’s integration time to see which events survive averaging.',
    controls: [
      choice('bin', 'Detector integration time', [[0.05, '50 ms'], [0.1, '100 ms'], [0.2, '200 ms'], [0.4, '400 ms'], [0.8, '800 ms'], [1.6, '1,600 ms']], '0.2'),
      slider('threshold', 'Bright-bin threshold', 0.10, 0.90, 0.05, 0.50, v => v.toFixed(2)),
      slider('exponent', 'Dwell-density exponent m', 1.2, 2.2, 0.05, 1.55, v => v.toFixed(2))
    ],
    initial: { seed: 621, traceNumber: 1 },
    action: ['resample', 'Generate another trace'],
    legend: [['Underlying on/off', 'plumdash'], ['Binned intensity', 'peach'], ['Threshold', 'dash']],
    tryIt: 'Keep the same trace and compare 50 ms with 800 ms bins. An intermediate intensity can come from switches inside one bin. The apparent bright-time fraction also depends on where you place the threshold.',
    model: 'Underlying bright and dark levels are 1 and 0. The simulator draws independent on and off dwell times from the same bounded density, p(τ) ∝ τ⁻ᵐ, between 35 ms and 3.5 s. A bin’s intensity is the exact fraction of its time spent bright. Intensities at or above the threshold count as bright. This noise-free 16 s illustration isolates time resolution. Experimental photon statistics, background, bleaching and censoring affect inference. Estimating a power-law exponent requires many dwell times and a model for sampling.',
    dataLabel: 'Inspect the detector bins',
    render(s, width) {
      const intervals = dwellTimes(s.exponent, s.seed), dt = Number(s.bin), bins = binTrace(intervals, dt);
      const f = frame(width, { xmin: 0, xmax: traceDuration, ymin: -0.10, ymax: 1.12, xLabel: 'Observation time (s)', yLabel: 'Relative emission intensity', yTicks: [0, 0.5, 1], xTicks: width < 420 ? [0, 4, 8, 12, 16] : [0, 2, 4, 6, 8, 10, 12, 14, 16] });
      let drawing = path(stepPoints(intervals.map(a => [a.start, a.end, Number(a.bright)]), f, v => v), color.plum, 'stroke-width="1.3" stroke-dasharray="3 3" opacity="0.88"');
      drawing += line(f.left, f.y(s.threshold), f.right, f.y(s.threshold), color.pale, 'stroke-dasharray="5 5" stroke-width="1.2"');
      drawing += path(stepPoints(bins.map(b => [b.lo, b.hi, b.intensity]), f, v => v), color.peach, 'stroke-width="2.4"');
      const states = bins.map(b => b.intensity + 1e-12 >= s.threshold);
      const switches = states.filter((v, i) => i > 0 && v !== states[i - 1]).length;
      const brightShare = states.filter(Boolean).length / states.length * 100;
      const trueShare = intervals.reduce((v, d) => v + (d.bright ? d.end - d.start : 0), 0) / traceDuration * 100;
      return {
        graph: svg(f, `Synthetic trace ${s.traceNumber} contains ${intervals.length - 1} underlying switches and ${switches} switches resolved by thresholding ${dt * 1000} millisecond bins.`, drawing),
        values: [['Underlying switches', intervals.length - 1], ['Detected switches', switches], ['Bins classified bright', `${brightShare.toFixed(1)}%`]],
        explanation: `Trace ${s.traceNumber} spends ${trueShare.toFixed(1)}% of its underlying duration bright. Integrating over ${Math.round(dt * 1000)} ms gives ${bins.length} detector bins. Changing the bin width or threshold retains this same underlying trajectory.`,
        data: () => table(['Bin', 'Time interval (s)', 'Mean intensity', 'Assigned state'], bins.map((b, i) => [i + 1, `${b.lo.toFixed(2)}–${b.hi.toFixed(2)}`, b.intensity.toFixed(4), states[i] ? 'Bright' : 'Dark']), `Trace ${s.traceNumber} integrated in ${Math.round(dt * 1000)} ms bins`)
      };
    }
  };

  const models = { ir: infrared, dynamics, rna: fret, nano: blinking };

  function mount(element, id) {
    if (!element || typeof element.replaceChildren !== 'function') return null;
    const previous = instances.get(element);
    if (previous) previous.destroy();
    const model = models[id];
    if (!model) { element.replaceChildren(); return null; }
    const key = `nesbitt-lab-${++count}`;
    const state = {};
    const resetState = () => {
      Object.assign(state, model.initial || {});
      model.controls.forEach(c => { state[c.key] = c.value; });
    };
    resetState();
    const panel = document.createElement('section');
    panel.className = 'nl-panel';
    panel.setAttribute('aria-labelledby', `${key}-heading`);
    const referenceLinks = refs[id].map(([name, url]) => `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${safe(name)} <span aria-hidden="true">↗</span></a>`).join('');
    panel.innerHTML = `<div class="nl-heading"><h3 id="${key}-heading">${safe(model.title)}</h3><p>${safe(model.intro)}</p></div><div class="nl-instrument"><div class="nl-chart" data-graph></div>${legend(model.legend)}</div><div class="nl-controls">${model.controls.map(c => control(c, key)).join('')}</div><div class="nl-actions">${model.action ? `<button type="button" data-lab-action="${model.action[0]}">${safe(model.action[1])}</button>` : ''}<button type="button" data-lab-action="reset">Reset parameters</button></div><dl class="nl-readings" aria-live="polite" aria-atomic="true"></dl><p class="nl-observation" data-explanation></p><div class="nl-experiment"><h4>Try it</h4><p>${safe(model.tryIt)}</p></div><details class="nl-details" data-record><summary>${safe(model.dataLabel)}</summary><div data-table></div></details><details class="nl-details"><summary>Model and assumptions</summary><p>${safe(model.model)}</p></details><div class="nl-references"><span>Sources</span>${referenceLinks}</div>`;
    element.replaceChildren(panel);
    const graph = panel.querySelector('[data-graph]'), values = panel.querySelector('.nl-readings'), explanation = panel.querySelector('[data-explanation]'), record = panel.querySelector('[data-record]'), data = panel.querySelector('[data-table]');
    let current, lastWidth = 0, observer;
    function update() {
      lastWidth = Math.round(graph.clientWidth || element.clientWidth || 640);
      for (const c of model.controls) {
        const input = panel.querySelector(`[data-control="${c.key}"]`);
        if (String(input.value) !== String(state[c.key])) input.value = state[c.key];
        if (c.type === 'range') {
          const formatted = c.format(state[c.key]);
          panel.querySelector(`[data-value="${c.key}"]`).textContent = formatted;
          input.setAttribute('aria-valuetext', formatted);
          input.style.setProperty('--nl-fill', `${100 * (state[c.key] - c.min) / (c.max - c.min)}%`);
        }
      }
      current = model.render(state, lastWidth);
      graph.innerHTML = current.graph;
      const html = readings(current.values);
      if (values.innerHTML !== html) values.innerHTML = html;
      explanation.textContent = current.explanation;
      if (record.open) data.innerHTML = current.data();
    }
    function onInput(event) {
      const control = event.target.dataset.control;
      if (!control) return;
      state[control] = event.target.type === 'range' ? Number(event.target.value) : event.target.value;
      update();
    }
    function onClick(event) {
      const target = event.target.closest?.('[data-lab-action], [data-stick]');
      if (!target || !panel.contains(target)) return;
      if (target.dataset.stick) state.selected = target.dataset.stick;
      if (target.dataset.labAction === 'reset') resetState();
      if (target.dataset.labAction === 'midpoint') state.distance = state.radius;
      if (target.dataset.labAction === 'resample') { state.seed = (state.seed + 2711499) >>> 0; state.traceNumber++; }
      update();
    }
    const showData = () => { if (record.open && current) data.innerHTML = current.data(); };
    panel.addEventListener('input', onInput);
    panel.addEventListener('click', onClick);
    record.addEventListener('toggle', showData);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (!element.isConnected) { observer.disconnect(); return; }
        if (graph.clientWidth && Math.round(graph.clientWidth) !== lastWidth) update();
      });
      observer.observe(graph);
    }
    const handle = { destroy() {
      observer?.disconnect();
      panel.removeEventListener('input', onInput);
      panel.removeEventListener('click', onClick);
      record.removeEventListener('toggle', showData);
      panel.remove();
      instances.delete(element);
    } };
    instances.set(element, handle);
    return handle;
  }

  window.NesbittLab = Object.freeze({ mount });
})();
