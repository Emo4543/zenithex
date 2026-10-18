(() => {
  const api = window.zenith;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let games = [], settings = {}, targets = [], customPath = null;

  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3400);
    setTimeout(() => t.remove(), 3900);
  }

  // ---- pencere ----
  $('#wMin').onclick = () => api.invoke('win:min');
  $('#wMax').onclick = () => api.invoke('win:max');
  $('#wClose').onclick = () => api.invoke('win:close');

  // ---- sekmeler ----
  $$('.nav').forEach((b) => {
    b.onclick = () => {
      $$('.nav').forEach((x) => x.classList.toggle('active', x === b));
      $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    };
  });

  // ---- splash ----
  let pct = 0;
  const iv = setInterval(() => {
    pct = Math.min(100, pct + Math.random() * 9 + 3);
    $('#splashBar').style.width = pct + '%';
    $('#splashPct').textContent = Math.floor(pct) + '%';
    if (pct >= 100) {
      clearInterval(iv);
      setTimeout(() => $('#splash').classList.add('hide'), 350);
    }
  }, 120);

  // ---- istatistik ----
  api.on('stats', (s) => {
    $('#cpuV').textContent = s.cpu + '%';
    $('#cpuB').style.width = s.cpu + '%';
    const r = Math.round((s.ramUsed / s.ramTotal) * 100);
    $('#ramV').textContent = r + '%';
    $('#ramB').style.width = r + '%';
  });

  // ---- oyunlar ----
  const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  function renderGames() {
    const q = $('#search').value.trim().toLowerCase();
    const list = games.filter((g) => g.name.toLowerCase().includes(q));
    $('#gameCount').textContent = games.length;
    const grid = $('#grid');
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="empty">Oyun bulunamadı. "Yeniden Tara" ya da "Oyun Ekle" ile ekleyebilirsin.</div>';
      return;
    }
    list.forEach((g) => {
      const h = hue(g.name);
      const c = document.createElement('div');
      c.className = 'card';
      c.style.background = `linear-gradient(135deg,hsl(${h},65%,28%),hsl(${(h + 50) % 360},70%,10%))`;
      c.innerHTML = `<div class="big">${esc(g.name[0] || '?').toUpperCase()}</div><div class="src">${esc(g.source)}</div>${g.source === 'Manuel' ? '<button class="rm" title="Kaldır">✕</button>' : ''}<h4>${esc(g.name)}</h4><button class="play">⚡ Boost + Başlat</button>`;
      $('.play', c).onclick = async (e) => {
        e.target.disabled = true;
        $$('.nav')[1].click();
        const r = await api.invoke('boost:launch', g.id);
        e.target.disabled = false;
        if (!r.ok) toast(r.error || 'Başlatılamadı', 'err');
      };
      const rm = $('.rm', c);
      if (rm) rm.onclick = async () => { games = await api.invoke('games:remove', g.id); renderGames(); };
      grid.appendChild(c);
    });
  }

  $('#search').oninput = renderGames;
  $('#btnAdd').onclick = async () => { games = await api.invoke('games:add'); renderGames(); };
  $('#btnScan').onclick = async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Taranıyor...';
    games = await api.invoke('games:scan');
    e.target.disabled = false;
    e.target.textContent = '⟳ Yeniden Tara';
    renderGames();
    toast(`${games.length} oyun listelendi`);
  };

  // ---- ayarlar / booster ----
  function applyAccent(a) { document.body.dataset.accent = a; }

  async function saveSet(patch) { settings = await api.invoke('settings:set', patch); }

  function renderApps() {
    const box = $('#appList');
    box.innerHTML = '';
    (settings.apps || []).forEach((name) => {
      const row = document.createElement('label');
      row.className = 'appitem';
      const on = (settings.appsEnabled || []).includes(name);
      row.innerHTML = `<label class="sw"><input type="checkbox" ${on ? 'checked' : ''}><b></b></label><span>${esc(name)}</span>`;
      $('input', row).onchange = async (e) => {
        const set = new Set(settings.appsEnabled || []);
        e.target.checked ? set.add(name) : set.delete(name);
        await saveSet({ appsEnabled: [...set] });
      };
      box.appendChild(row);
    });
  }

  $('#appAdd').onclick = async () => {
    const v = $('#appInput').value.trim().replace(/\.exe$/i, '').replace(/[^\w.-]/g, '');
    if (!v) return;
    const apps = new Set(settings.apps || []);
    apps.add(v);
    await saveSet({ apps: [...apps] });
    $('#appInput').value = '';
    renderApps();
  };

  $$('[data-set]').forEach((el) => {
    el.onchange = () => saveSet({ [el.dataset.set]: el.checked });
  });

  $$('.ac').forEach((b) => {
    b.onclick = async () => { applyAccent(b.dataset.accent); await saveSet({ accent: b.dataset.accent }); };
  });

  function log(msg) {
    const l = $('#boostLog');
    const d = document.createElement('div');
    d.textContent = msg;
    l.appendChild(d);
    l.scrollTop = l.scrollHeight;
  }
  api.on('boost:status', (m) => { log(m); if (m.startsWith('✔')) toast('Boost bitti, ayarlar geri alındı'); });

  $('#btnStop').onclick = async () => { await api.invoke('boost:stop'); };
  $('#btnResume').onclick = async () => { await api.invoke('sys:resume'); toast('Askıdaki uygulamalar devam ettirildi'); };

  // ---- grafik ----
  async function loadTargets() {
    targets = await api.invoke('gfx:targets');
    const sel = $('#gfxTarget');
    sel.innerHTML = '';
    targets.forEach((t, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = t.label;
      sel.appendChild(o);
    });
    const o = document.createElement('option');
    o.value = 'custom';
    o.textContent = 'Özel INI / ayar dosyası...';
    sel.appendChild(o);
    updateTargetUi();
  }

  function currentTarget() {
    const v = $('#gfxTarget').value;
    if (v === 'custom') return customPath ? { type: 'custom', path: customPath } : null;
    return targets[+v] || null;
  }

  function updateTargetUi() {
    const isCustom = $('#gfxTarget').value === 'custom';
    $('#customBox').classList.toggle('hidden', !isCustom);
    const t = currentTarget();
    $('#gfxPath').textContent = t ? t.path : isCustom ? 'Bir dosya seç.' : 'Desteklenen oyun bulunamadı. Özel INI modunu dene.';
  }

  $('#gfxTarget').onchange = updateTargetUi;
  $('#gfxPick').onclick = async () => {
    const p = await api.invoke('gfx:pickIni');
    if (p) { customPath = p; updateTargetUi(); }
  };
  $('#gfxBri').oninput = (e) => { $('#briV').textContent = e.target.value; };

  $('#gfxApply').onclick = async () => {
    const t = currentTarget();
    if (!t) return toast('Önce bir hedef seç', 'err');
    const res = $('#gfxRes').value;
    const [w, h] = res === 'keep' ? [0, 0] : res.split('x').map(Number);
    const fs = $('#gfxFs').value;
    const r = await api.invoke('gfx:apply', t, {
      preset: $('input[name=preset]:checked').value,
      width: w,
      height: h,
      fullscreen: fs,
      brightness: +$('#gfxBri').value,
      custom: $('#gfxCustom').value,
    });
    toast(r.ok ? r.note || 'Uygulandı' : r.error, r.ok ? '' : 'err');
  };

  $('#gfxRestore').onclick = async () => {
    const t = currentTarget();
    if (!t) return toast('Önce bir hedef seç', 'err');
    const r = await api.invoke('gfx:restore', t);
    toast(r.ok ? 'Orijinal ayarlar geri yüklendi' : r.error, r.ok ? '' : 'err');
  };

  // ---- araçlar ----
  async function runTool(btn, fn, fmt) {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Çalışıyor...';
    try { toast(fmt(await fn())); } catch (e) { toast('Hata: ' + e.message, 'err'); }
    btn.disabled = false;
    btn.textContent = old;
  }
  $('#tRam').onclick = (e) => runTool(e.target, () => api.invoke('sys:ram'), (r) => `RAM temizlendi: +${r.freedMB} MB (${r.freeMB} MB boş)`);
  $('#tTemp').onclick = (e) => runTool(e.target, () => api.invoke('sys:temp'), (r) => `${r.freedMB} MB geçici dosya silindi`);
  $('#tDns').onclick = (e) => runTool(e.target, () => api.invoke('sys:dns'), (r) => (r.ok ? 'DNS önbelleği temizlendi' : 'DNS temizlenemedi'));

  // dvr/capture/fso: anahtar AÇIK = özellik kapalı (optimizasyon aktif). gamemode: AÇIK = özellik açık.
  const INVERTED = { dvr: true, capture: true, fso: true, gamemode: false };

  async function loadTools() {
    const gb = await api.invoke('sys:gamebar:get');
    for (const id of Object.keys(INVERTED)) {
      const el = $(`[data-tool=${id}]`);
      el.checked = INVERTED[id] ? !gb[id] : gb[id];
    }
    $('[data-tool=nagle]').checked = await api.invoke('sys:nagle:get');
  }

  $$('[data-tool]').forEach((el) => {
    el.onchange = async () => {
      const id = el.dataset.tool;
      if (id === 'nagle') {
        const now = await api.invoke('sys:nagle:set', el.checked);
        el.checked = now;
        toast(now ? 'Nagle kapatıldı' : 'Nagle varsayılana döndü (izin verilmediyse değişmez)');
        return;
      }
      const enabled = INVERTED[id] ? !el.checked : el.checked;
      await api.invoke('sys:gamebar:set', id, enabled);
      toast('Ayar uygulandı');
    };
  });

  // ---- başlangıç ----
  (async () => {
    settings = await api.invoke('settings:get');
    applyAccent(settings.accent);
    $$('[data-set]').forEach((el) => { el.checked = !!settings[el.dataset.set]; });
    renderApps();
    games = await api.invoke('games:list');
    renderGames();
    if (!games.length) {
      games = await api.invoke('games:scan');
      renderGames();
    }
    loadTargets();
    loadTools();
  })();
})();
