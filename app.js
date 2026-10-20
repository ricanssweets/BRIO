/* =========================================================================
   B.R.I.O. — Base Racional de Ideas y Objetivos
   Lógica de la aplicación (todo local: nada sale del dispositivo).

   Correcciones de esta versión (detalle en LEEME-CAMBIOS.md):
   1. Fechas en hora LOCAL. Antes se usaba toISOString() (UTC) para leer la
      fecha y se volvía a UTC al sumar días: en Puerto Rico el contador se
      adelantaba un día por la noche y al este de UTC todas las fechas del
      ciclo salían un día antes.
   2. Cualquier texto del usuario se escapa antes de entrar en innerHTML.
   3. Los registros se guardan POR FECHA (con migración de los datos viejos),
      lo que permite saber si ya cumpliste hoy y calcular rachas.
   4. Si el navegador no puede guardar, se avisa en pantalla (antes solo se
      escribía en la consola y el usuario perdía datos en silencio).
   5. El estado guardado se valida y se repara al cargar; si está corrupto,
      aparece una pantalla de recuperación en vez de quedarse en blanco.
   6. Exportar/Importar copia de seguridad.
   7. Accesibilidad: foco gestionado, diálogo real con Escape y trampa de
      foco, etiquetas asociadas, ARIA en progreso y botones, navegación por
      teclado.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- utils */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid() {
    return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------- fechas */
  /* Siempre hora local. Nunca toISOString() para fechas de calendario. */
  function isoOf(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function parseISO(s) {
    const p = String(s || '').split('-').map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    const d = new Date(p[0], p[1] - 1, p[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  function todayISO() { return isoOf(new Date()); }

  function addDays(s, n) {
    const d = parseISO(s) || new Date();
    d.setDate(d.getDate() + n);
    return isoOf(d);
  }

  function daysBetween(a, b) {
    const d1 = parseISO(a), d2 = parseISO(b);
    if (!d1 || !d2) return 0;
    const u1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const u2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((u2 - u1) / 86400000);
  }

  function fmtDate(s) {
    const d = parseISO(s);
    if (!d) return '–';
    try { return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return isoOf(d); }
  }

  /* ------------------------------------------------------------ catálogo */
  const PILARES = [
    { key: 'espiritual', n: 1, nombre: 'Espiritual', desc: 'Paz interior, gratitud, oración y conexión contigo mismo.', sugerencias: [
      { t: 'Meditar', c: 10, f: 'dia', suf: ' min/día' }, { t: 'Orar y agradecer', c: 1, f: 'dia', suf: ' vez/día' }, { t: 'Hacer yoga', c: 3, f: 'semana', suf: ' veces/sem' }, { t: 'Leer libros espirituales', c: 2, f: 'ciclo', suf: ' libros' }
    ] },
    { key: 'personal', n: 2, nombre: 'Personal', desc: 'Salud física, nutrición, hábitos mentales y descanso.', sugerencias: [
      { t: 'Entrenamiento / Caminata', c: 4, f: 'semana', suf: ' veces/sem' }, { t: 'Dormir 7 a 8 horas', c: 1, f: 'dia', suf: ' vez/día' }, { t: 'Cero bebidas azucaradas', c: 1, f: 'ciclo', suf: ' meta ciclo' }
    ] },
    { key: 'familia', n: 3, nombre: 'Familia', desc: 'Tiempo de calidad, atención y relaciones afectivas.', sugerencias: [
      { t: 'Cena en pareja sin celular', c: 1, f: 'semana', suf: ' vez/sem' }, { t: 'Jugar con mis hijos', c: 30, f: 'dia', suf: ' min/día' }, { t: 'Llamar a la familia', c: 1, f: 'semana', suf: ' vez/sem' }
    ] },
    { key: 'profesional', n: 4, nombre: 'Profesional', desc: 'Habilidades, crecimiento de negocio y disciplina.', sugerencias: [
      { t: 'Estudiar o tomar curso', c: 2, f: 'mes', suf: ' veces/mes' }, { t: 'Puntualidad 15 min antes', c: 1, f: 'dia', suf: ' vez/día' }, { t: 'Promover negocio en redes', c: 1, f: 'dia', suf: ' vez/día' }
    ] },
    { key: 'financiera', n: 5, nombre: 'Financiera', desc: 'Presupuesto, ahorro y control de finanzas.', sugerencias: [
      { t: 'Ahorrar porcentaje mensual', c: 1, f: 'mes', suf: ' vez/mes' }, { t: 'Actualizar libro de gastos', c: 1, f: 'semana', suf: ' vez/sem' }, { t: 'Reducir deudas', c: 1, f: 'ciclo', suf: ' meta ciclo' }
    ] },
    { key: 'comunidad', n: 6, nombre: 'Comunidad', desc: 'Impacto social positivo y servicio al prójimo.', sugerencias: [
      { t: 'Servicio comunitario', c: 1, f: 'mes', suf: ' vez/mes' }, { t: 'Donación a organización', c: 1, f: 'mes', suf: ' vez/mes' }
    ] },
    { key: 'placer', n: 7, nombre: 'Placer', desc: 'Hobbies, recreación y recarga de energía personal.', sugerencias: [
      { t: 'Día libre recreativo', c: 2, f: 'mes', suf: ' veces/mes' }, { t: 'Lectura de entretenimiento', c: 2, f: 'ciclo', suf: ' libros' }, { t: 'Sesión de spa o masaje', c: 1, f: 'ciclo', suf: ' vez' }
    ] }
  ];

  const CYCLE_DAYS = 120;
  const STORAGE_KEY = 'brio_app_state_v1';
  const STATE_VERSION = 2;
  const MAX_GOALS_PER_PILLAR = 5;
  const MIN_GOALS_PER_PILLAR = 3;

  let state = null;
  let currentPillarKey = null;
  let editingGoalId = null;
  let lastFocused = null;
  let updateReloaded = false;

  function emptyState() {
    const goals = {};
    PILARES.forEach(function (p) { goals[p.key] = []; });
    return { version: STATE_VERSION, profile: null, goals: goals, logs: {}, history: [] };
  }

  /* ------------------------------------------------- estado: validación */
  /* v1 guardaba un único contador por objetivo: { id: {count: N} }
     v2 guarda registros por fecha:               { id: { 'YYYY-MM-DD': N } }
     Lo migrado de v1 se conserva bajo __legacy para no perder el avance. */
  function normalizeLogs(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (id) {
      const entry = raw[id];
      if (entry == null) return;
      // variante defensiva: un número suelto
      if (typeof entry === 'number') {
        if (entry > 0) out[id] = { __legacy: Math.floor(entry) };
        return;
      }
      if (typeof entry !== 'object') return;
      const bucket = {};
      // v1 real: { count: N } — un único contador acumulado del ciclo
      const legacy = Number(entry.count);
      if (isFinite(legacy) && legacy > 0) bucket.__legacy = Math.floor(legacy);
      // v2: { 'YYYY-MM-DD': N } y el total migrado en __legacy
      const legacyKey = Number(entry.__legacy);
      if (isFinite(legacyKey) && legacyKey > 0) {
        bucket.__legacy = Math.max(bucket.__legacy || 0, Math.floor(legacyKey));
      }
      Object.keys(entry).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        const v = Number(entry[k]);
        if (!isFinite(v) || v <= 0) return;
        bucket[k] = Math.floor(v);
      });
      if (Object.keys(bucket).length) out[id] = bucket;
    });
    return out;
  }

  function normalizeState(raw) {
    const base = emptyState();
    if (!raw || typeof raw !== 'object') return base;

    if (raw.profile && typeof raw.profile === 'object') {
      const p = raw.profile;
      const inicio = /^\d{4}-\d{2}-\d{2}$/.test(p.inicio || '') ? p.inicio : todayISO();
      const nombre = String(p.nombre || '').slice(0, 80);
      const apellido = String(p.apellido || '').slice(0, 80);
      base.profile = {
        nombre: nombre,
        apellido: apellido,
        nombreCompleto: String(p.nombreCompleto || (apellido ? nombre + ' ' + apellido : nombre)).slice(0, 160),
        profesion: String(p.profesion || '').slice(0, 80),
        telefono: String(p.telefono || '').slice(0, 20),
        correo: String(p.correo || '').slice(0, 120),
        inicio: inicio,
        firmado: p.firmado !== false
      };
    }

    const rawGoals = raw.goals && typeof raw.goals === 'object' ? raw.goals : {};
    PILARES.forEach(function (p) {
      const arr = Array.isArray(rawGoals[p.key]) ? rawGoals[p.key] : [];
      base.goals[p.key] = arr
        .filter(function (g) { return g && typeof g === 'object'; })
        .slice(0, MAX_GOALS_PER_PILLAR)
        .map(function (g) {
          const frec = ['dia', 'semana', 'mes', 'ciclo'].indexOf(g.frecuencia) >= 0 ? g.frecuencia : 'dia';
          return {
            id: (typeof g.id === 'string' && g.id) ? g.id : uid(),
            texto: String(g.texto || '').slice(0, 300),
            cantidad: Math.min(1000, Math.max(1, Math.round(Number(g.cantidad) || 1))),
            frecuencia: frec
          };
        });
    });

    base.logs = normalizeLogs(raw.logs);

    base.history = Array.isArray(raw.history) ? raw.history
      .filter(function (h) { return h && typeof h === 'object'; })
      .slice(-50)
      .map(function (h) {
        return {
          inicio: String(h.inicio || ''),
          fin: String(h.fin || ''),
          progresoFinal: Math.max(0, Math.min(1, Number(h.progresoFinal) || 0)),
          metas: Array.isArray(h.metas) ? h.metas.slice(0, 40).map(function (m) {
            return {
              texto: String(m.texto || '').slice(0, 300),
              cantidad: Math.round(Number(m.cantidad) || 0),
              frecuencia: String(m.frecuencia || ''),
              total: Math.round(Number(m.total) || 0),
              cumplido: Math.round(Number(m.cumplido) || 0)
            };
          }) : []
        };
      }) : [];

    return base;
  }

  function loadState() {
    let raw = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      raw = stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Estado guardado ilegible:', e);
      raw = null;
    }
    state = normalizeState(raw);
  }

  /* ------------------------------------------------------- estado: guardar */
  function setSaveWarning(on) {
    const box = $('saveWarn');
    if (!box) return;
    if (on) {
      box.textContent = 'No se pudieron guardar los datos en este dispositivo (almacenamiento lleno o navegación privada). ' +
        'Exporta una copia en Perfil → Zona de Datos antes de cerrar.';
      box.hidden = false;
    } else {
      box.textContent = '';
      box.hidden = true;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveWarning(false);
      return true;
    } catch (e) {
      console.error('No se pudieron guardar los datos:', e);
      setSaveWarning(true);
      return false;
    }
  }

  function requestPersistence() {
    try {
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(function () {});
      }
    } catch (e) { /* opcional */ }
  }

  /* ----------------------------------------------------------- ciclo */
  function elapsedDays() {
    if (!state.profile || !state.profile.inicio) return 0;
    return Math.max(0, Math.min(CYCLE_DAYS, daysBetween(state.profile.inicio, todayISO())));
  }
  function daysLeft() { return Math.max(0, CYCLE_DAYS - elapsedDays()); }
  /* Convención: el día de inicio es el Día 1 y el ciclo dura 120 días
     contando ese primero, así que termina en inicio + 119. */
  function cycleDayNumber() { return Math.min(CYCLE_DAYS, elapsedDays() + 1); }
  function cycleEndISO(inicio) { return addDays(inicio || todayISO(), CYCLE_DAYS - 1); }
  function cycleFinished() { return elapsedDays() >= CYCLE_DAYS; }

  /* ------------------------------------------------------------ metas */
  function goalTarget(g) {
    const c = Math.min(1000, Math.max(1, Number(g.cantidad) || 1));
    if (g.frecuencia === 'dia') return Math.round(c * CYCLE_DAYS);
    if (g.frecuencia === 'semana') return Math.max(1, Math.round(c * (CYCLE_DAYS / 7)));
    if (g.frecuencia === 'mes') return Math.max(1, Math.round(c * (CYCLE_DAYS / 30)));
    return c;
  }
  function goalBucket(id) { return state.logs[id] || null; }
  function goalCount(id) {
    const b = goalBucket(id);
    if (!b) return 0;
    let total = 0;
    Object.keys(b).forEach(function (k) { total += Number(b[k]) || 0; });
    return total;
  }
  function todayCount(id) {
    const b = goalBucket(id);
    return b ? (Number(b[todayISO()]) || 0) : 0;
  }
  function streakDays(id) {
    const b = goalBucket(id);
    if (!b) return 0;
    let cursor = todayISO();
    if (!(Number(b[cursor]) > 0)) {
      cursor = addDays(cursor, -1);
      if (!(Number(b[cursor]) > 0)) return 0;
    }
    let n = 0;
    while (n < CYCLE_DAYS + 1 && Number(b[cursor]) > 0) { n++; cursor = addDays(cursor, -1); }
    return n;
  }
  function goalExpectedByNow(g) { return goalTarget(g) * (elapsedDays() / CYCLE_DAYS); }
  function allGoalsFlat() {
    const arr = [];
    PILARES.forEach(function (p) { (state.goals[p.key] || []).forEach(function (g) { arr.push(g); }); });
    return arr;
  }
  function overallProgress() {
    const goals = allGoalsFlat();
    if (!goals.length) return 0;
    let sum = 0;
    goals.forEach(function (g) {
      const t = goalTarget(g);
      sum += Math.min(1, t > 0 ? goalCount(g.id) / t : 0);
    });
    return sum / goals.length;
  }
  function pillarProgress(key) {
    const goals = state.goals[key] || [];
    if (!goals.length) return 0;
    let sum = 0;
    goals.forEach(function (g) {
      const t = goalTarget(g);
      sum += Math.min(1, t > 0 ? goalCount(g.id) / t : 0);
    });
    return sum / goals.length;
  }
  function freqLabel(f) {
    return { dia: 'al día', semana: 'a la semana', mes: 'al mes', ciclo: 'en el ciclo' }[f] || f;
  }

  /* ------------------------------------------------- errores en línea */
  function setFieldError(id, message) {
    const field = $(id);
    const box = $(id + '_error');
    if (field) field.setAttribute('aria-invalid', 'true');
    if (box) { box.textContent = message; box.hidden = false; }
    if (field && typeof field.focus === 'function') field.focus();
  }
  function clearFieldError(id) {
    const field = $(id);
    const box = $(id + '_error');
    if (field) field.removeAttribute('aria-invalid');
    if (box) { box.textContent = ''; box.hidden = true; }
  }

  function showChrome(on) {
    const bar = $('mainTopBar'), nav = $('navbar');
    if (bar) bar.style.display = on ? 'flex' : 'none';
    if (nav) nav.style.display = on ? 'flex' : 'none';
  }

  /* --------------------------------------------------------- pantallas */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    const target = $(id);
    if (!target) return;
    target.classList.add('active');

    document.querySelectorAll('.navbtn').forEach(function (b) {
      const isActive = b.dataset && b.dataset.nav === id;
      b.classList.toggle('active', isActive);
      if (isActive) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });

    window.scrollTo(0, 0);
    /* Llevar el foco al título: sin esto, quien navega con teclado se queda
       en un botón que acaba de ocultarse y no sabe que la pantalla cambió. */
    const heading = target.querySelector('h1, h2, [tabindex="-1"]');
    if (heading && typeof heading.focus === 'function') {
      try { heading.focus(); } catch (e) { /* innecesario */ }
    }
  }

  function goDashboard() {
    renderDashboard();
    showScreen('screen-dashboard');
  }

  /* ----------------------------------------------------------- contrato */
  function renderContrato() {
    const inicioEl = $('c_inicio');
    if (inicioEl && !inicioEl.value) inicioEl.value = todayISO();
    updateFinPreview();
  }

  function updateFinPreview() {
    const el = $('c_inicio');
    const inicio = (el && el.value) ? el.value : todayISO();
    const preview = $('c_finPreview');
    if (preview) preview.textContent = 'Tu ciclo concluye el ' + fmtDate(cycleEndISO(inicio)) + ' (120 días contando el de inicio).';
  }

  /* ------------------------------------------------------------ render */
  function renderMetas() {
    const wrap = $('pillarList');
    if (!wrap) return;
    wrap.innerHTML = '';
    PILARES.forEach(function (p) {
      const goals = state.goals[p.key] || [];
      const pct = Math.round(pillarProgress(p.key) * 100);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pillar-row';
      btn.setAttribute('aria-label', p.nombre + ': ' + goals.length + (goals.length === 1 ? ' objetivo' : ' objetivos') + ', ' + pct + ' por ciento de avance. Abrir detalle.');
      btn.innerHTML =
        '<div class="pilar-tile small" aria-hidden="true">' + p.n + '</div>' +
        '<div class="pillar-info">' +
          '<div class="pillar-name">' + esc(p.nombre) + '</div>' +
          '<div class="pillar-count">' + goals.length + (goals.length === 1 ? ' objetivo' : ' objetivos') +
            (goals.length < MIN_GOALS_PER_PILLAR ? ' · completa mínimo ' + MIN_GOALS_PER_PILLAR : '') + '</div>' +
          '<div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div class="pillar-pct mono" aria-hidden="true">' + pct + '%</div>';
      btn.addEventListener('click', function () { openPillar(p.key); });
      wrap.appendChild(btn);
    });
  }

  function renderDashboard() {
    if (!state.profile) return;
    const left = daysLeft();
    const pct = overallProgress();

    const daysEl = $('heroDaysLeft'), dayOfEl = $('heroDayOf');
    const rangeEl = $('heroDateRange'), badgeEl = $('topDayBadge');
    if (daysEl) daysEl.textContent = left;
    if (dayOfEl) dayOfEl.textContent = 'Día ' + cycleDayNumber() + ' de ' + CYCLE_DAYS;
    if (rangeEl) rangeEl.textContent = fmtDate(state.profile.inicio) + ' → ' + fmtDate(cycleEndISO(state.profile.inicio));
    if (badgeEl) badgeEl.textContent = 'DÍA ' + cycleDayNumber() + '/' + CYCLE_DAYS;

    const doneWarn = $('cycleDoneWarn');
    if (doneWarn) doneWarn.hidden = !cycleFinished();

    const circumference = 2 * Math.PI * 32;
    const ring = $('ringProgress');
    if (ring) {
      ring.setAttribute('stroke-dasharray', circumference);
      ring.setAttribute('stroke-dashoffset', circumference * (1 - pct));
    }
    const ringPct = $('ringPct');
    if (ringPct) ringPct.textContent = Math.round(pct * 100) + '%';
    const ringLabel = $('ringLabel');
    if (ringLabel) ringLabel.textContent = 'Progreso general del ciclo: ' + Math.round(pct * 100) + ' por ciento. Día ' + cycleDayNumber() + ' de ' + CYCLE_DAYS + '.';

    const wrap = $('dashPillarList');
    if (!wrap) return;
    wrap.innerHTML = '';
    PILARES.forEach(function (p) {
      const goals = state.goals[p.key] || [];
      const pp = Math.round(pillarProgress(p.key) * 100);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pillar-row';
      btn.setAttribute('aria-label', p.nombre + ': ' + (goals.length ? goals.length + (goals.length === 1 ? ' meta activa' : ' metas activas') : 'sin objetivos') + ', ' + pp + ' por ciento de avance. Abrir detalle.');
      btn.innerHTML =
        '<div class="pilar-tile small" aria-hidden="true">' + p.n + '</div>' +
        '<div class="pillar-info">' +
          '<div class="pillar-name">' + esc(p.nombre) + '</div>' +
          '<div class="pillar-count">' + (goals.length ? goals.length + ' metas activas' : 'Sin objetivos aún') + '</div>' +
          '<div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:' + pp + '%"></div></div>' +
        '</div>' +
        '<div class="pillar-pct mono" aria-hidden="true">' + pp + '%</div>';
      btn.addEventListener('click', function () { openPillar(p.key); });
      wrap.appendChild(btn);
    });
  }

  function openPillar(key) {
    const p = PILARES.filter(function (x) { return x.key === key; })[0];
    if (!p) return;
    currentPillarKey = key;
    const tile = $('pd_tile'), title = $('pd_title'), desc = $('pd_desc');
    if (tile) tile.textContent = p.n;
    if (title) title.textContent = p.nombre;
    if (desc) desc.textContent = p.desc;
    renderPillarGoals();
    renderPillarChips();
    showScreen('screen-pillar');
  }

  function renderPillarGoals() {
    const goals = state.goals[currentPillarKey] || [];
    const warnEl = $('pd_warn');
    if (warnEl) {
      warnEl.innerHTML = goals.length < MIN_GOALS_PER_PILLAR
        ? '<div class="warn">Agrega al menos ' + MIN_GOALS_PER_PILLAR + ' objetivos en esta columna (máximo ' + MAX_GOALS_PER_PILLAR + ').</div>'
        : '';
    }
    const addBtn = $('pd_addBtn');
    if (addBtn) addBtn.style.display = goals.length >= MAX_GOALS_PER_PILLAR ? 'none' : '';

    const listEl = $('pd_goalList');
    if (!listEl) return;
    if (!goals.length) {
      listEl.innerHTML = '<div class="empty">No tienes objetivos asignados.<br>Agrega uno nuevo o toca una sugerencia rápida.</div>';
      return;
    }
    listEl.innerHTML = '';

    goals.forEach(function (g) {
      const target = goalTarget(g);
      const count = goalCount(g.id);
      const hoy = todayCount(g.id);
      const streak = streakDays(g.id);
      const pct = target > 0 ? Math.min(100, Math.round(count / target * 100)) : 0;
      const expected = goalExpectedByNow(g);
      const label = esc(g.texto || 'objetivo');

      let pace = '';
      if (count >= target) pace = '<span class="pace-tag pace-done">Meta alcanzada</span>';
      else if (elapsedDays() > 2) {
        pace = count >= expected
          ? '<span class="pace-tag pace-good">Al día</span>'
          : '<span class="pace-tag pace-behind">Atrasado</span>';
      }
      const todayTag = hoy > 0 ? '<span class="today-badge">Hecho hoy' + (hoy > 1 ? ' ×' + hoy : '') + '</span>' : '';
      const streakTag = streak > 1 ? '<span class="streak-badge">' + streak + ' días seguidos</span>' : '';

      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML =
        '<div class="goal-top">' +
          '<div>' +
            '<div class="goal-text">' + esc(g.texto) + '</div>' +
            '<div class="goal-freq">' + esc(g.cantidad) + ' ' + esc(freqLabel(g.frecuencia)) + ' · Meta total: ' + target + todayTag + streakTag + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="goal-progress-row">' +
          '<button class="minusbtn" type="button" data-act="minus" data-id="' + esc(g.id) + '" aria-label="Quitar un registro de hoy en ' + label + '">−</button>' +
          '<div style="flex:1;">' +
            '<div class="bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Avance de ' + label + '">' +
              '<div class="bar-fill" style="width:' + pct + '%"></div>' +
            '</div>' +
          '</div>' +
          '<div class="goal-count mono">' + count + '/' + target + '</div>' +
          '<button class="plusbtn" type="button" data-act="plus" data-id="' + esc(g.id) + '" aria-label="Registrar un avance de hoy en ' + label + '">+</button>' +
        '</div>' +
        pace +
        '<div style="margin-top:10px;">' +
          '<button class="btn btn-secondary btn-sm" type="button" data-act="edit" data-id="' + esc(g.id) + '">Editar</button>' +
        '</div>';
      listEl.appendChild(card);
    });

    listEl.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.dataset.act, id = btn.dataset.id;
        if (act === 'plus') logGoal(id, 1);
        if (act === 'minus') logGoal(id, -1);
        if (act === 'edit') openGoalModal(id);
      });
    });
  }

  /* Los registros van por fecha: el botón + suma al día de HOY. */
  function logGoal(id, delta) {
    const today = todayISO();
    const bucket = state.logs[id] || (state.logs[id] = {});
    const current = Number(bucket[today]) || 0;
    const next = Math.max(0, current + delta);
    if (next > 0) bucket[today] = next;
    else delete bucket[today];
    if (!Object.keys(bucket).length) delete state.logs[id];
    saveState();
    renderPillarGoals();
    renderMetas();
  }

  function renderPillarChips() {
    const p = PILARES.filter(function (x) { return x.key === currentPillarKey; })[0];
    const box = $('pd_chips');
    const boxWrap = $('pd_suggestBox');
    if (!p || !box) return;
    const goals = state.goals[currentPillarKey] || [];
    box.innerHTML = '';
    if (goals.length >= MAX_GOALS_PER_PILLAR) {
      if (boxWrap) boxWrap.style.display = 'none';
      return;
    }
    if (boxWrap) boxWrap.style.display = 'block';
    p.sugerencias.forEach(function (s) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = s.t + ' (' + s.c + ' ' + s.suf + ')';
      chip.addEventListener('click', function () {
        const arr = state.goals[currentPillarKey];
        if (arr.length >= MAX_GOALS_PER_PILLAR) return;
        arr.push({ id: uid(), texto: s.t, cantidad: s.c, frecuencia: s.f });
        saveState();
        renderPillarGoals();
        renderPillarChips();
        renderMetas();
      });
      box.appendChild(chip);
    });
  }

  /* ------------------------------------------------------------- modal */
  function openGoalModal(goalId) {
    const overlay = $('goalOverlay');
    if (!overlay) return;
    editingGoalId = goalId;
    lastFocused = document.activeElement;
    clearFieldError('g_texto');

    if (goalId) {
      const g = (state.goals[currentPillarKey] || []).filter(function (x) { return x.id === goalId; })[0];
      if (!g) return;
      $('goalModalTitle').textContent = 'Editar objetivo';
      $('g_texto').value = g.texto;
      $('g_cantidad').value = g.cantidad;
      $('g_frecuencia').value = g.frecuencia;
      $('g_deleteBtn').style.display = 'block';
    } else {
      $('goalModalTitle').textContent = 'Nuevo objetivo';
      $('g_texto').value = '';
      $('g_cantidad').value = 1;
      $('g_frecuencia').value = 'dia';
      $('g_deleteBtn').style.display = 'none';
    }
    updateTargetPreview();
    overlay.classList.add('active');
    setTimeout(function () { const t = $('g_texto'); if (t && t.focus) t.focus(); }, 30);
  }

  function closeGoalModal() {
    const overlay = $('goalOverlay');
    if (overlay) overlay.classList.remove('active');
    editingGoalId = null;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) { /* innecesario */ }
    }
    lastFocused = null;
  }

  function updateTargetPreview() {
    const c = Math.min(1000, Math.max(1, Math.round(Number($('g_cantidad').value) || 1)));
    const f = $('g_frecuencia').value;
    const t = goalTarget({ cantidad: c, frecuencia: f });
    const preview = $('g_targetPreview');
    if (preview) preview.textContent = 'Total en 120 días: ' + t + ' repeticiones.';
  }

  /* ----------------------------------------------------- zona de datos */
  function setDataMsg(msg, isError) {
    const el = $('dataMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? '#f87171' : '';
  }

  function exportBackup() {
    const payload = JSON.stringify(state, null, 2);
    const box = $('exportBox');
    const copyBtn = $('btnCopyExport');
    if (box) { box.value = payload; box.hidden = false; }
    if (copyBtn) copyBtn.hidden = false;

    let downloaded = false;
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'brio-respaldo-' + todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 5000);
      downloaded = true;
    } catch (e) {
      console.error('No se pudo descargar el respaldo:', e);
    }
    setDataMsg(downloaded
      ? 'Copia descargada. Si tu navegador la bloqueó, copia el texto de abajo y guárdalo como .json.'
      : 'No se pudo descargar sola. Copia el texto de abajo y guárdalo como .json.');
  }

  function importBackup(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { setDataMsg('El archivo no es un respaldo válido (JSON ilegible).', true); return; }
    if (!data || typeof data !== 'object' || (!data.profile && !data.goals)) {
      setDataMsg('El archivo no parece un respaldo de B.R.I.O.', true);
      return;
    }
    if (!confirm('Se reemplazarán los datos actuales por los del archivo. ¿Continuar?')) return;

    state = normalizeState(data);
    saveState();
    if (state.profile && state.profile.firmado) {
      showChrome(true);
      renderMetas();
      renderDashboard();
      renderPerfil();
      showScreen('screen-perfil');
    } else {
      showChrome(false);
      renderContrato();
      showScreen('screen-contrato');
    }
    setDataMsg('Respaldo importado correctamente.');
  }

  /* ------------------------------------------------------------ perfil */
  function renderPerfil() {
    if (!state.profile) return;
    const p = state.profile;
    const nombreMostrar = p.nombreCompleto || (p.apellido ? p.nombre + ' ' + p.apellido : p.nombre);

    $('pf_nombre').textContent = nombreMostrar || '–';
    $('pf_profesion').textContent = p.profesion || 'No especificado';
    $('pf_telefono').textContent = p.telefono || 'No especificado';
    $('pf_correo').textContent = p.correo || 'No especificado';
    $('pf_ciclo').textContent = fmtDate(p.inicio) + ' → ' + fmtDate(cycleEndISO(p.inicio));

    const goals = allGoalsFlat();
    const totalTarget = goals.reduce(function (s, g) { return s + goalTarget(g); }, 0);
    const totalDone = goals.reduce(function (s, g) { return s + Math.min(goalTarget(g), goalCount(g.id)); }, 0);
    const pctGlobal = Math.round(overallProgress() * 100);
    const barPct = totalTarget ? Math.round(totalDone / totalTarget * 100) : 0;

    $('pf_summary').innerHTML =
      '<div class="row2">' +
        '<div><div class="muted">Metas fijadas</div><div style="font-weight:800; font-size:20px;" class="mono">' + goals.length + '</div></div>' +
        '<div><div class="muted">Progreso global</div><div style="font-weight:800; font-size:20px;" class="mono">' + pctGlobal + '%</div></div>' +
      '</div>' +
      '<div class="bar-track" style="margin-top:12px;" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + barPct + '" aria-label="Progreso global del ciclo"><div class="bar-fill" style="width:' + barPct + '%"></div></div>' +
      '<p class="muted" style="margin-top:10px;">Día ' + cycleDayNumber() + ' de ' + CYCLE_DAYS + ' · ' + daysLeft() + ' días restantes · ' + totalDone + ' de ' + totalTarget + ' repeticiones.</p>';

    const histEl = $('pf_history');
    if (!histEl) return;
    if (!state.history.length) {
      histEl.innerHTML = '<div class="empty">Todavía no has cerrado ningún ciclo de 120 días.</div>';
      return;
    }
    histEl.innerHTML = state.history.slice().reverse().map(function (h) {
      const metas = (h.metas && h.metas.length)
        ? '<div class="muted" style="margin-top:6px;">' + h.metas.map(function (m) {
            return esc(m.texto) + ' <span class="mono">' + m.cumplido + '/' + m.total + '</span>';
          }).join('<br>') + '</div>'
        : '';
      return '<div class="history-item"><b>' + fmtDate(h.inicio) + ' → ' + fmtDate(h.fin) + '</b>' +
        ' · <span class="mono">' + Math.round((h.progresoFinal || 0) * 100) + '%</span>' + metas + '</div>';
    }).join('');
  }

  /* -------------------------------------------------- pantalla de error */
  function showFatal() {
    let raw = '(no accesible)';
    try { raw = localStorage.getItem(STORAGE_KEY) || '(vacío)'; } catch (e) { /* modo privado */ }
    const app = $('app');
    if (!app) return;

    /* Se construye con createElement y referencias directas: sin ids nuevos,
       sin volver a buscar en el DOM y sin innerHTML con datos. */
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '24px';

    const h1 = document.createElement('h1');
    h1.tabIndex = -1;
    h1.style.cssText = 'font-size:18px; font-weight:800;';
    h1.textContent = 'No se pudieron cargar tus datos';

    const p = document.createElement('p');
    p.className = 'muted';
    p.style.marginTop = '8px';
    p.textContent = 'El estado guardado está dañado o el navegador lo bloqueó. Abajo tienes el contenido tal cual quedó guardado: cópialo si quieres conservarlo.';

    const box = document.createElement('textarea');
    box.className = 'mono io-box';
    box.readOnly = true;
    box.setAttribute('aria-label', 'Datos guardados sin procesar');
    box.value = raw;

    const selBtn = document.createElement('button');
    selBtn.type = 'button';
    selBtn.className = 'btn btn-secondary';
    selBtn.style.marginTop = '10px';
    selBtn.textContent = 'Seleccionar todo';
    selBtn.addEventListener('click', function () { if (box.select) box.select(); });

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-danger';
    resetBtn.style.marginTop = '10px';
    resetBtn.textContent = 'Empezar de cero';
    resetBtn.addEventListener('click', function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* modo privado */ }
      if (window.location && typeof window.location.reload === 'function') window.location.reload();
    });

    card.appendChild(h1);
    card.appendChild(p);
    card.appendChild(box);
    card.appendChild(selBtn);
    card.appendChild(resetBtn);
    app.innerHTML = '';
    app.appendChild(card);
  }

  /* ------------------------------------------------------ service worker */
  function wireServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
        if (reg.waiting) showUpdateBar();
        reg.addEventListener('updatefound', function () {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar();
          });
        });
      }).catch(function (err) { console.log('SW no registrado:', err); });
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* Solo recargamos si ya había un SW controlando: en la primera visita
         no hay nada que actualizar. */
      if (updateReloaded || !hadController) return;
      updateReloaded = true;
      if (window.location && typeof window.location.reload === 'function') window.location.reload();
    });
  }

  function showUpdateBar() {
    const bar = $('updateBar');
    if (bar) bar.classList.add('show');
  }

  /* ----------------------------------------------------------- eventos */
  function wireEvents() {
    /* teléfono: formatea al escribir y acepta pegado con formato o +1 */
    const telInput = $('c_telefono');
    if (telInput) {
      telInput.addEventListener('input', function (e) {
        let digits = String(e.target.value || '').replace(/\D/g, '');
        if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
        digits = digits.slice(0, 10);
        let formatted = digits;
        if (digits.length > 6) formatted = digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
        else if (digits.length > 3) formatted = digits.slice(0, 3) + '-' + digits.slice(3);
        e.target.value = formatted;
      });
    }

    const inicioEl = $('c_inicio');
    if (inicioEl) inicioEl.addEventListener('change', updateFinPreview);

    const formContrato = $('formContrato');
    if (formContrato) {
      formContrato.addEventListener('submit', function (e) {
        e.preventDefault();
        ['c_nombre', 'c_telefono', 'c_correo', 'c_firma'].forEach(clearFieldError);

        const nombre = $('c_nombre').value.trim();
        const apellido = $('c_apellido').value.trim();
        const telefono = $('c_telefono').value.trim();
        const correo = $('c_correo').value.trim();
        const firma = $('c_firma').checked;
        const correoEl = $('c_correo');

        if (!nombre) { setFieldError('c_nombre', 'Escribe tu nombre.'); return; }
        if (telefono && telefono.replace(/\D/g, '').length !== 10) {
          setFieldError('c_telefono', 'El teléfono debe tener 10 dígitos (Ej: 787-555-1234).');
          return;
        }
        if (correo && correoEl && typeof correoEl.checkValidity === 'function' && !correoEl.checkValidity()) {
          setFieldError('c_correo', 'Ese correo no parece válido.');
          return;
        }
        if (!firma) { setFieldError('c_firma', 'Marca la casilla para confirmar tu compromiso.'); return; }

        state.profile = {
          nombre: nombre,
          apellido: apellido,
          nombreCompleto: apellido ? nombre + ' ' + apellido : nombre,
          profesion: $('c_profesion').value.trim(),
          telefono: telefono,
          correo: correo,
          inicio: $('c_inicio').value || todayISO(),
          firmado: true
        };
        saveState();
        requestPersistence();
        renderPerfil();
        showChrome(true);
        renderMetas();
        showScreen('screen-metas');
      });
    }

    const wire = function (id, event, fn) {
      const el = $(id);
      if (el) el.addEventListener(event, fn);
    };

    wire('metasBackBtn', 'click', goDashboard);
    wire('pillarBackBtn', 'click', goDashboard);
    wire('navDashboard', 'click', goDashboard);
    wire('navMetas', 'click', function () { renderMetas(); showScreen('screen-metas'); });
    wire('navPerfil', 'click', function () { renderPerfil(); showScreen('screen-perfil'); });
    wire('dashConfigBtn', 'click', function () { renderMetas(); showScreen('screen-metas'); });
    wire('pd_addBtn', 'click', function () { openGoalModal(null); });
    wire('goalCloseBtn', 'click', closeGoalModal);

    const cantidadEl = $('g_cantidad');
    if (cantidadEl) cantidadEl.addEventListener('input', updateTargetPreview);
    const frecEl = $('g_frecuencia');
    if (frecEl) frecEl.addEventListener('change', updateTargetPreview);

    const formGoal = $('formGoal');
    if (formGoal) {
      formGoal.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFieldError('g_texto');
        const texto = $('g_texto').value.trim().slice(0, 300);
        if (!texto) { setFieldError('g_texto', 'Describe el objetivo.'); return; }
        const cantidad = Math.min(1000, Math.max(1, Math.round(Number($('g_cantidad').value) || 1)));
        const frecuencia = $('g_frecuencia').value;
        const arr = state.goals[currentPillarKey];

        if (editingGoalId) {
          const g = arr.filter(function (x) { return x.id === editingGoalId; })[0];
          if (g) { g.texto = texto; g.cantidad = cantidad; g.frecuencia = frecuencia; }
        } else {
          if (arr.length >= MAX_GOALS_PER_PILLAR) { setFieldError('g_texto', 'Máximo ' + MAX_GOALS_PER_PILLAR + ' metas por columna.'); return; }
          arr.push({ id: uid(), texto: texto, cantidad: cantidad, frecuencia: frecuencia });
        }
        saveState();
        closeGoalModal();
        renderPillarGoals();
        renderPillarChips();
        renderMetas();
      });
    }

    wire('g_deleteBtn', 'click', function () {
      if (!confirm('¿Deseas eliminar este objetivo? Su historial de registros también se borra.')) return;
      const arr = state.goals[currentPillarKey];
      const idx = arr.findIndex(function (x) { return x.id === editingGoalId; });
      if (idx > -1) {
        delete state.logs[arr[idx].id];
        arr.splice(idx, 1);
      }
      saveState();
      closeGoalModal();
      renderPillarGoals();
      renderPillarChips();
      renderMetas();
    });

    /* modal: Escape, trampa de foco y clic en el fondo */
    const overlay = $('goalOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeGoalModal(); });
    }
    document.addEventListener('keydown', function (e) {
      const ov = $('goalOverlay');
      if (!ov || !ov.classList.contains('active')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeGoalModal(); return; }
      if (e.key !== 'Tab') return;
      const dialog = document.querySelector('#goalOverlay [role="dialog"]');
      if (!dialog) return;
      const focusables = Array.prototype.filter.call(
        dialog.querySelectorAll('button, textarea, input, select'),
        function (el) { return !el.disabled; }
      );
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    wire('btnExport', 'click', exportBackup);
    wire('btnImport', 'click', function () {
      const file = $('importFile');
      if (file && typeof file.click === 'function') file.click();
    });
    wire('importFile', 'change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () { importBackup(String(reader.result || '')); };
      reader.onerror = function () { setDataMsg('No se pudo leer el archivo.', true); };
      reader.readAsText(file);
      e.target.value = '';
    });
    wire('btnCopyExport', 'click', function () {
      const box = $('exportBox');
      if (!box) return;
      const done = function () { setDataMsg('Copia en el portapapeles.'); };
      const fail = function () { try { box.select(); } catch (e) {} setDataMsg('Selecciona el texto y cópialo manualmente.'); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(box.value).then(done).catch(fail);
        } else { fail(); }
      } catch (e) { fail(); }
    });

    wire('btnNuevoCiclo', 'click', function () {
      if (!state.profile) return;
      if (!confirm('¿Iniciar un nuevo ciclo de 120 días? El ciclo actual se guarda en el historial con tus metas.')) return;
      const metas = allGoalsFlat().map(function (g) {
        return { texto: g.texto, cantidad: g.cantidad, frecuencia: g.frecuencia, total: goalTarget(g), cumplido: goalCount(g.id) };
      });
      state.history.push({
        inicio: state.profile.inicio,
        fin: cycleEndISO(state.profile.inicio),
        progresoFinal: overallProgress(),
        metas: metas
      });
      if (state.history.length > 50) state.history = state.history.slice(-50);
      state.logs = {};
      state.profile.inicio = todayISO();
      saveState();
      renderPerfil();
      renderDashboard();
      goDashboard();
    });

    wire('btnReset', 'click', function () {
      if (!confirm('Esto borra TODOS tus datos de este dispositivo: perfil, metas, registros e historial. ¿Continuar?')) return;
      state = emptyState();
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* modo privado */ }
      saveState();
      showChrome(false);
      const box = $('exportBox'), copyBtn = $('btnCopyExport');
      if (box) { box.hidden = true; box.value = ''; }
      if (copyBtn) copyBtn.hidden = true;
      setDataMsg('');
      renderContrato();
      showScreen('screen-contrato');
    });

    wire('btnReload', 'click', function () {
      const bar = $('updateBar');
      if (bar) bar.classList.remove('show');
      if (window.location && typeof window.location.reload === 'function') window.location.reload();
    });
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    try {
      loadState();
      wireEvents();
      wireServiceWorker();

      if (state.profile && state.profile.firmado) {
        showChrome(true);
        renderMetas();
        renderDashboard();
        renderPerfil();
        goDashboard();
      } else {
        showChrome(false);
        renderContrato();
        showScreen('screen-contrato');
      }
    } catch (err) {
      console.error('Error al iniciar B.R.I.O.:', err);
      showFatal();
    }
  }

  boot();
})();
  
