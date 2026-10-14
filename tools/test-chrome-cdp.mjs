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

  // 2. Simula clique na tela sobre o menu ou tecla 'B'
  const clickOnB = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', key: 'B' }));
      return 'Tecla [B] disparada com sucesso';
    })()`,
    returnByValue: true
  });
  console.log(clickOnB.result?.value);

  await new Promise(r => setTimeout(r, 400));

  // 3. Simula tecla para avançar de LEG_INTRO para PLAYING
  const clickToPlay = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      return 'Espaço para iniciar jogabilidade disparado';
    })()`,
    returnByValue: true
  });
  console.log(clickToPlay.result?.value);

  // Aguarda 1.0s de navegação ativa
  await new Promise(r => setTimeout(r, 1000));

  // Ativa o HUD de Telemetria com a tecla 'T'
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 'T' }));
    })()`
  });

  // Vira o leme para bombordo (ArrowLeft) para orçar fora de ferro em direção a 015°
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));
    })()`
  });

  await new Promise(r => setTimeout(r, 600));

  // Solta a tecla do leme (volta a neutro) e navega por 1.5s
  await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' }));
    })()`
  });

  await new Promise(r => setTimeout(r, 1500));

  // Verifica estado do veleiro e pixels no buffer CGA
  const boatStatus = await sendCmd('Runtime.evaluate', {
    expression: `(() => {
      const cga = window.v1Renderer?.cga;
      const buf = cga?.buf;
      let redPixels = 0, greenPixels = 0, brownPixels = 0;
      if (buf) {
        for (let y = 8; y < 190; y++) {
          for (let x = 8; x < 192; x++) {
            const c = buf[y * 320 + x];
            if (c === 2) redPixels++;
            else if (c === 1) greenPixels++;
            else if (c === 3) brownPixels++;
          }
        }
      }

      return {
        state: window.v1Game?.state,
        boatSpeed: window.v1Game?.boat?.speed?.toFixed(2),
        boatHeading: window.v1Game?.boat?.heading?.toFixed(1),
        apparentWindAngle: window.v1Game?.boat?.apparentWindAngle?.toFixed(1),
        pointOfSail: window.v1Game?.boat?.pointOfSail,
        sheetAngle: window.v1Game?.boat?.sheetAngle?.toFixed(1),
        boomAngle: window.v1Game?.boat?.boomAngle?.toFixed(1),
        boatX: window.v1Game?.boat?.x?.toFixed(1),
        boatY: window.v1Game?.boat?.y?.toFixed(1),
        telemetryActive: window.v1Renderer?.showTelemetry,
        sectorMapRedPixels: redPixels,
        sectorMapGreenPixels: greenPixels,
        sectorMapBrownPixels: brownPixels,
        score: window.v1Game?.score
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
