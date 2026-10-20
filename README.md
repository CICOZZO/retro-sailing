# ⛵ SAILING — Edição Retrô

Recriação em navegador do jogo **"Sailing… an adventure in the Bermuda Triangle"** (Wind Productions, © 1982, PC/CGA) e de um simulador náutico 3D em aramado (1986).

🔗 **[JOGAR ONLINE (GitHub Pages)](https://cicozzo.github.io/retro-sailing/)**

---

## Versão 1 — Wind Productions (1982), CGA 320×200

Reescrita para reproduzir o jogo original conforme o vídeo de referência (https://youtu.be/zO7vTsZEvuY).

**Tela (paleta CGA 0: preto, verde, vermelho, marrom):**
* **Esquerda:** o mar em escala próxima, um setor por vez (a tela troca ao cruzar a borda). Ilhas em verde, parede de caveiras na borda do mundo.
* **Direita, em cima:** o barco visto de cima, girando com o rumo — casco vermelho, retranca marrom, leme verde.
* **Faixa abaixo:** medidor de velocidade.
* **Direita, embaixo:** radar com o mapa das Bermudas (você, náufragos e o fim da perna).
* **Laterais do radar:** **D** dano e **F** combustível. **Rodapé:** tempo, barcos restantes e pontuação.

**Controles (teclado numérico, ou a fileira de números):**

| Tecla | Função |
| :--- | :--- |
| **4 / 5 / 6** | Leme: bombordo / centro / boreste |
| **7 / 8 / 9** | Folgar a vela 2° / 5° / 10° |
| **1 / 2 / 3** | Caçar a vela 2° / 5° / 10° |
| **E** | Motor liga/desliga (gasta combustível) |
| **S** · **P** | Som · Pausa |
| **Q** | Encerra a perna de treino, ou o jogo, salvando a pontuação |
| **X** | Sai |

Sem teclado numérico: **← →** leme, **↑** caça, **↓** folga.

**Menu:** (B) começar · (P) perna de treino · (A) todas as instruções · (O)bjetivo · (C)ontroles · (S)coring · (H)azards · (G)auges.

**Regras:** 3 pernas (Miami → Bermuda → San Juan → Miami) recolhendo náufragos e rafters e chegando ao porto. Perigos: **Creeping Mist** (volta ao início da perna, −25), **Gravitational Vortex** (teletransporta, −25), **Speed Boats** (afundam o barco, −50) e **Demonic Storm** (inverte os controles).

### O que é medido do vídeo e o que é inferido
* **Medido:** layout, cores, textos das telas de instruções, teclas, tipos de perigo e penalidades, velocidade típica (~6 px/s).
* **Inferido (ajustável):** direção do vento (`V1_WIND_FROM` em `js/v1/v1-boat.js`), polar de velocidade, pontuação por náufrago e bônus de tempo, geografia exata do mapa e posição dos portos.

### 📱 Versão mobile (iPhone e iPad)

`mobile.html` — só em paisagem, com o jogo em formato wide ocupando a altura toda (as 3 telas num bloco central). O menu inicial funciona por botões laterais; ao começar a perna aparecem os controles: **slider vertical do leme** (esquerda, com botão CENTER), **slider vertical da vela** (direita, IN/OUT), botão **MOTOR**, pausa e sair. iPhone/iPad abrindo `index.html` são redirecionados para ela (use `index.html?pc` para forçar a versão de PC). A versão de PC não tem os sliders.

## Versão 2 — Simulador 3D wireframe (1986)

Perspectiva aramada com modos fósforo verde, âmbar e CGA colorido (`versao2.html`).

---

## 🚀 Como executar localmente

Abra `index.html` em qualquer navegador moderno, ou dê duplo clique em `JOGAR.bat`. Não precisa de instalação nem servidor.

## 🧪 Teste de fumaça

`node tools/test-chrome-cdp.mjs` (PC) e `node tools/test-mobile.mjs` (mobile, emulando iPhone com toque) abrem o Chrome headless, percorre título → menu → instruções → perna 1 e confere o estado do jogo (screenshots vão para a pasta TEMP).
