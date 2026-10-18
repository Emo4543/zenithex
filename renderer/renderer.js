const $ = (id) => document.getElementById(id);
const code = $('code'), hl = $('hl'), tabsEl = $('tabs'), out = $('out');

const KW = new Set('and break continue do else elseif end false for function if in local nil not or repeat return then true until while export type'.split(' '));
const BI = new Set('game workspace script plugin print warn error pcall xpcall assert task wait spawn delay require typeof type tostring tonumber pairs ipairs next select table string math os Instance Vector3 Vector2 CFrame Color3 UDim2 UDim Enum Random tick time setmetatable getmetatable rawget rawset unpack'.split(' '));
const RE = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\w.]*\b)|([A-Za-z_]\w*)/g;

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function highlight(src) {
  RE.lastIndex = 0;
  let outp = '', last = 0, m;
  while ((m = RE.exec(src))) {
    outp += esc(src.slice(last, m.index));
    const t = m[0];
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : KW.has(t) ? 'k' : BI.has(t) ? 'b' : '';
    outp += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
    last = RE.lastIndex;
  }
  return outp + esc(src.slice(last)) + '\n';
}

let tabs = [], active = 0, counter = 0;

function render() {
  tabsEl.innerHTML = '';
  tabs.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'tab' + (i === active ? ' active' : '');
    el.innerHTML = `<span>${esc(t.name)}</span><span class="x">x</span>`;
    el.onclick = () => { active = i; render(); };
    el.querySelector('.x').onclick = (e) => {
      e.stopPropagation();
      if (tabs.length === 1) { tabs[0].source = ''; } else { tabs.splice(i, 1); active = Math.min(active, tabs.length - 1); }
      render();
    };
    tabsEl.appendChild(el);
  });
  code.value = tabs[active].source;
  hl.innerHTML = highlight(code.value);
}

function addTab(name, source) {
  counter++;
  tabs.push({ name: name || 'Script ' + counter, source: source || '' });
  active = tabs.length - 1;
  render();
}

code.addEventListener('input', () => {
  tabs[active].source = code.value;
  hl.innerHTML = highlight(code.value);
});
code.addEventListener('scroll', () => { hl.scrollTop = code.scrollTop; hl.scrollLeft = code.scrollLeft; });
code.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = code.selectionStart;
    code.setRangeText('\t', s, code.selectionEnd, 'end');
    code.dispatchEvent(new Event('input'));
  }
});

function log(kind, msg) {
  const d = document.createElement('div');
  d.className = kind;
  d.textContent = msg;
  out.appendChild(d);
  out.scrollTop = out.scrollHeight;
}

$('btnExec').onclick = async () => {
  const src = tabs[active].source;
  if (!src.trim()) return log('warn', 'Çalıştırılacak kod yok.');
  if (!(await window.api.status())) {
    log('warn', 'Studio bağlı değil. Studio\'yu aç, Bridge eklentisinde "Bridge" düğmesine bas.');
  }
  await window.api.send(src);
  log('info', '▶ ' + tabs[active].name + ' Studio\'ya gönderildi...');
};
$('btnClear').onclick = () => { out.innerHTML = ''; tabs[active].source = ''; render(); };
$('btnTab').onclick = () => addTab();
$('btnOpen').onclick = async () => {
  const f = await window.api.openFile();
  if (f) addTab(f.name, f.content);
};
$('btnSave').onclick = async () => {
  const n = await window.api.saveFile({ name: tabs[active].name, content: tabs[active].source });
  if (n) { tabs[active].name = n; render(); log('info', 'Kaydedildi: ' + n); }
};

window.api.onResult((d) => log(d.kind || 'print', d.msg));

setInterval(async () => {
  const on = await window.api.status();
  const s = $('status');
  s.className = 'status ' + (on ? 'on' : 'off');
  s.textContent = on ? 'Studio: bağlı' : 'Studio: bağlı değil';
}, 1500);

const hubEl = $('hub');
HUB.forEach((h) => {
  const c = document.createElement('div');
  c.className = 'card';
  c.innerHTML = `<h4>${esc(h.name)}</h4><p>${esc(h.desc)}</p>`;
  const load = document.createElement('button');
  load.textContent = 'Editöre Al';
  load.onclick = () => addTab(h.name, h.code);
  const run = document.createElement('button');
  run.className = 'neon';
  run.textContent = '▶ Çalıştır';
  run.onclick = async () => { addTab(h.name, h.code); $('btnExec').click(); };
  c.appendChild(load);
  c.appendChild(run);
  hubEl.appendChild(c);
});

addTab('Script 1', 'print("Merhaba Roblox Studio!")\n');
