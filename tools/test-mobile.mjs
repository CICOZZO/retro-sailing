import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Users\\ciro.cozzolino\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\Temp', 'chrome_sailing_test_' + Date.now());

fs.mkdirSync(TEMP_USER_DATA, { recursive: true });

console.log('Iniciando Chrome em:', CHROME_PATH);

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--remote-debugging-port=0',
  `--user-data-dir=${TEMP_USER_DATA}`,
  'about:blank'
], { stdio: 'pipe' });

chromeProc.on('error', (err) => {
  console.error('Falha ao iniciar Chrome:', err);
  process.exit(1);
});

// Aguarda o arquivo DevToolsActivePort ser gerado
async function waitForDevToolsPort(timeoutMs = 10000) {
  const portFile = path.join(TEMP_USER_DATA, 'DevToolsActivePort');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(portFile)) {
      const content = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (content.length >= 2) {
        return {
          port: parseInt(content[0].trim(), 10),
          wsPath: content[1].trim()
        };
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Timeout esperando DevToolsActivePort');
}

async function runTest() {
  const { port } = await waitForDevToolsPort();
  console.log(`Chrome ativo na porta ${port}!`);

  // Obtem páginas abertas
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const tabs = await listRes.json();
  console.log('Tabs encontradas:', tabs.map(t => ({ type: t.type, url: t.url })));
  const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
  const wsUrl = targetTab.webSocketDebuggerUrl;
  console.log('Conectando via WebSocket a:', wsUrl);

  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();

  function sendCmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const logs = [];
  const errors = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    } else if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value || a.description).join(' ');
      console.log(`[CHROME CONSOLE] ${data.params.type}:`, text);
      logs.push(text);
    } else if (data.method === 'Runtime.exceptionThrown') {
      const details = data.params.exceptionDetails;
      const msg = details.exception?.description || details.text;
      console.error(`[CHROME ERRO JS]:`, msg);
      errors.push(msg);
    }
  };

  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');
  // iPhone em paisagem, com toque
  await sendCmd('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
  await sendCmd('Emulation.setTouchEmulationEnabled', { enabled: true });

  const fileUrl = new URL('../mobile.html', import.meta.url).href;
  const loaded = new Promise(resolve => {
    ws.addEventListener('message', (ev) => { if (JSON.parse(ev.data).method === 'Page.loadEventFired') resolve(); });
  });
  await sendCmd('Page.navigate', { url: fileUrl });
  await loaded;
  await new Promise(r => setTimeout(r, 800));

  const evalJs = async (expr) => (await sendCmd('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const shot = async (name) => {
    const s = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const p = path.join(process.env.TEMP || '.', name);
    fs.writeFileSync(p, Buffer.from(s.data, 'base64'));
    console.log('Screenshot salvo em:', p);
  };
  const click = (sel) => evalJs(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const drag = async (sel, frac) => {
    const r = await evalJs(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.left + b.width / 2, top: b.top, h: b.height }; })()`);
    const y = r.top + r.h * frac;
    await sendCmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.top + r.h / 2 }] });
    await sendCmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x, y }] });
    await sendCmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const mode = () => evalJs('document.body.dataset.mode + "/" + window.v1Game.state');

  console.log('Início:', await mode());
  await evalJs('window.v1Press(" ")'); await wait(200);
  console.log('Após toque:', await mode());
  await shot('mobile-menu.png');

  await click('.col-left [data-key="B"]'); await wait(200);
  console.log('Perna 1:', await mode());
  await evalJs('window.v1Press(" ")'); await wait(300);
  console.log('Navegando:', await mode());

  await drag('#sliderSheet', 0.7);        // folga a vela
  await drag('#sliderRudder', 0.2);       // leme a boreste
  await click('#btnEngine');
  await wait(3000);

  const st = await evalJs(`(() => { const b = window.v1Game.boat; return {
    sheet: b.sheet, rudder: b.rudder, engine: b.engine, speed: +b.speed.toFixed(2), heading: +b.heading.toFixed(1),
    engineBtnOn: document.getElementById('btnEngine').classList.contains('on'),
    canvas: (() => { const r = document.getElementById('v1GameCanvas').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()
  }; })()`);
  console.log('Estado:', st);
  await shot('mobile-play.png');

  ws.close();
  chromeProc.kill();
  const ok = errors.length === 0 && st.sheet > 40 && st.rudder > 10 && st.engine;
  if (!ok) { console.error('FALHA', errors, st); process.exit(1); }
  console.log('Teste mobile concluído com SUCESSO!');
  process.exit(0);
}

runTest().catch((err) => { console.error('Erro no teste:', err); chromeProc.kill(); process.exit(1); });
