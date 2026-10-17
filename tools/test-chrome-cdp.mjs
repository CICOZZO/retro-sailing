import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  'C:\\Users\\ciro.cozzolino\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];
const CHROME_PATH = CHROME_CANDIDATES.find(p => p && fs.existsSync(p)) || CHROME_CANDIDATES[0];
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

  // Habilita domínios
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');

  const fileUrl = new URL('../index.html', import.meta.url).href;
  console.log('Navegando para:', fileUrl);

  const loadPromise = new Promise(resolve => {
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Page.loadEventFired') {
        resolve();
      }
    };
    ws.addEventListener('message', handler);
  });

  await sendCmd('Page.navigate', { url: fileUrl });
  await loadPromise;
  console.log('Página carregada com sucesso!');

  // Aguarda 1s para executar os scripts e rendering
  await new Promise(r => setTimeout(r, 1000));

  // Avalia o estado na página
  const eval1 = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.getElementById('v1GameCanvas');
      return {
        hasCanvas: !!canvas,
        canvasW: canvas?.width,
        canvasH: canvas?.height,
        v1AudioExists: typeof window.v1Audio !== 'undefined',
        V1GameExists: typeof window.V1Game !== 'undefined',
        V1RendererExists: typeof window.V1Renderer !== 'undefined'
      };
    })()`,
    returnByValue: true
  });
  console.log('Estado inicial da página:', eval1.result?.value);

  // 1. Screenshot da tela de título
  const titleShot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  const titleShotPath = path.join(process.env.TEMP || '.', 'chrome-title.png');
  fs.writeFileSync(titleShotPath, Buffer.from(titleShot.data, 'base64'));
  console.log('Screenshot da tela de título salvo em', titleShotPath);

  // 2. Fluxo: título -> menu -> instruções -> perna -> navegando
  const evalJs = async (expr) => (await sendCmd('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
  const key = (k) => evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)} }))`);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const shot = async (name) => {
    const s = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const p = path.join(process.env.TEMP || '.', name);
    fs.writeFileSync(p, Buffer.from(s.data, 'base64'));
    console.log('Screenshot salvo em:', p);
  };

  await key(' '); await wait(200);
  console.log('Após tecla no título:', await evalJs('window.v1Game.state'));
  await shot('chrome-menu.png');

  await key('H'); await wait(200);
  console.log('Instruções:', await evalJs('window.v1Game.state + "/" + window.v1Game.instrKey'));
  await key(' '); await key(' '); await key(' '); await wait(200);   // até o storm
  await shot('chrome-hazard.png');
  await key(' '); await wait(200);
  console.log('De volta ao menu:', await evalJs('window.v1Game.state'));

  await key('B'); await wait(200);
  console.log('Perna 1:', await evalJs('window.v1Game.state'));
  await key(' '); await wait(300);
  console.log('Navegando:', await evalJs('window.v1Game.state'));

  // solta a vela e vira o leme; deixa o barco andar
  await key('9'); await key('9'); await key('9');
  await key('6'); await key('6');
  await wait(4000);
  await key('5');
  await wait(1500);

  const boatStatus = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const g = window.v1Game, b = g.boat, buf = window.v1Renderer.cga.buf;
      let red = 0, green = 0, brown = 0;
      for (let y = 8; y < 192; y++) for (let x = 8; x < 192; x++) {
        const c = buf[y * 320 + x];
        if (c === 2) red++; else if (c === 1) green++; else if (c === 3) brown++;
      }
      return {
        state: g.state, heading: +b.heading.toFixed(1), speed: +b.speed.toFixed(2),
        sheet: b.sheet, rudder: b.rudder, side: b.side, boomAngle: +b.boomAngle.toFixed(1),
        x: +b.x.toFixed(1), y: +b.y.toFixed(1), damage: b.damage, boats: g.boats, score: g.score,
        seaRed: red, seaGreen: green, seaBrown: brown
      };
    })()`,
    returnByValue: true
  });
  console.log('Status de jogo durante navegação:', boatStatus.result?.value);

  // Tira screenshot de navegação ativa
  const playShot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  const playShotPath = path.join(process.env.TEMP || '.', 'chrome-playing.png');
  fs.writeFileSync(playShotPath, Buffer.from(playShot.data, 'base64'));
  console.log('Screenshot de navegação ativa salvo em:', playShotPath);

  ws.close();
  chromeProc.kill();

  if (errors.length > 0) {
    console.error('Erros encontrados:', errors);
    process.exit(1);
  } else {
    console.log('Teste completo concluído com 100% de SUCESSO!');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('Erro no teste:', err);
  chromeProc.kill();
  process.exit(1);
});
