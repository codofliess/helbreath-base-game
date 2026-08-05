/**
 * Offline FAQ when XAI_API_KEY is missing (or as LLM fallback).
 * Keep aligned with docs/social/FREEZE-COPY.md + BITACORA product facts.
 */

function links() {
  const site = process.env.OFFICIAL_PLAY_URL || 'https://play.chainlords.net';
  const discord = process.env.OFFICIAL_DISCORD_URL || 'https://discord.gg/F4NwwbfKtj';
  const x = process.env.OFFICIAL_X_URL || 'https://x.com/ChainLordsHQ';
  return { site, discord, x };
}

const FAQ = [
  {
    keys: [/play|jugar|juego|jugamos|entrar|join|test|acceso|how.?to|empezar|start|c[oó]mo juego/i],
    en: () => {
      const { site, discord, x } = links();
      return `**How to play (test)**
1. Install Phantom: https://phantom.app/download
2. Seed phrase on paper only — never share.
3. Open **${site}** → **Play Now** (or #how-to-play / #announcements).
4. Connect wallet → character list → **World**.

Discord: ${discord}
X: ${x} (@ChainLordsHQ)`;
    },
    es: () => {
      const { site, discord, x } = links();
      return `**Cómo jugar (test)**
1. Instalá Phantom: https://phantom.app/download
2. Seed solo en papel — nunca la compartas.
3. Entrá a **${site}** → **Play Now** (o #how-to-play / #announcements).
4. Conectá wallet → lista de personajes → **World**.

Discord: ${discord}
X: ${x} (@ChainLordsHQ)`;
    },
  },
  {
    keys: [/\bx\b|twitter|tweet|follow|seguir|chainlordshq|@chain/i],
    en: () => {
      const { x, discord } = links();
      return `Official X: **@ChainLordsHQ** → ${x}
Follow for news + planned **utility airdrop eligibility** at claim time (not required to play; not investment advice).
Discord: ${discord}`;
    },
    es: () => {
      const { x, discord } = links();
      return `X oficial: **@ChainLordsHQ** → ${x}
Seguinos para noticias + elegibilidad de **rewards de utilidad** en el claim (no hace falta para jugar; no es consejo de inversión).
Discord: ${discord}`;
    },
  },
  {
    keys: [/wallet|phantom|seed|frase|phrase|login|conectar|backpack|solflare/i],
    en: () =>
      `Use **Phantom** (or compatible Solana wallet) from the **official** site only. Staff **never** DMs first asking for seeds or “connect here”. Write your seed on paper. Login issues: OS/browser + steps in #bug-reports or a mod in #support.`,
    es: () =>
      `Usá **Phantom** (u otra wallet Solana compatible) solo del sitio **oficial**. El staff **nunca** te escribe primero pidiendo seeds ni “conectá acá”. Anotá la seed en papel. Si falla el login: OS/browser + pasos en #bug-reports o un mod en #support.`,
  },
  {
    keys: [/character|personaje|crear char|new char|lista de|select.?char|slots?/i],
    en: () =>
      `After wallet connect you land on the **character list**. Create/select a char, then enter **World**. If the list is empty or fails to load: hard-refresh, check wallet is on Solana, then post OS/browser in #bug-reports.`,
    es: () =>
      `Después de conectar la wallet ves la **lista de personajes**. Creá/seleccioná uno y entrá a **World**. Si la lista no carga: hard-refresh, wallet en Solana, y si sigue mal → OS/browser en #bug-reports.`,
  },
  {
    keys: [/bug|error|crash|roto|no carga|broken|lag|freeze|blanco/i],
    en: () =>
      `Report in **#bug-reports** with: short title, OS/browser, character name or wallet last 4, steps, expected vs actual, screenshot. Thanks!`,
    es: () =>
      `Reportalo en **#bug-reports** con: título corto, OS/browser, nombre de char o últimas 4 del wallet, pasos, esperado vs actual, screenshot. ¡Gracias!`,
  },
  {
    keys: [/arena|1v1|3v3|torneo|tournament|sunday|domingo|coliseum|coliseo|inscrip/i],
    en: () => {
      const { site } = links();
      return `**Sunday Arena** (1v1 / 3v3): see #arena-news and #arena-lfg. Inscription pages: ${site}/arena-1v1.html and ${site}/arena-3v3.html (when the public stack is live). Rules/prizes only as staff post — I don't invent brackets.`;
    },
    es: () => {
      const { site } = links();
      return `**Arena de domingos** (1v1 / 3v3): mirá #arena-news y #arena-lfg. Inscripción: ${site}/arena-1v1.html y ${site}/arena-3v3.html (cuando el stack público esté arriba). Reglas/premios solo como publique staff — no invento brackets.`;
    },
  },
  {
    keys: [/\bek\b|enemy.?kill|enemy kill|galer[ií]a|gallery|pk|city.?kill/i],
    en: () =>
      `**EK (Enemy Kill)** gallery: not every kill counts as an “EK” for showcase (±10 level window and ladder rules). Rarity ties to victim rank on the **enemy city** killer ladder (e.g. Leg / Rare / Common bands when ladder is live). Details evolve in test — see #announcements.`,
    es: () =>
      `**EK (Enemy Kill)** en galería: no todo kill cuenta como EK de showcase (ventana de nivel ±10 y reglas de ladder). La rareza depende del rank de la víctima en el ladder de **ciudad enemiga** (bandas Leg / Rare / Common cuando el ladder esté live). Detalle evoluciona en test — mirá #announcements.`,
  },
  {
    keys: [/mint|mintear|nft|cnft|bubblegum|on.?chain|blockchain item/i],
    en: () =>
      `**Mint** is **server-controlled** (not free client spam): eligible high-value items only; mid farm stays inventory. Expect a small anti-spam fee (stable and/or $HELL band ~cheap, order of cents–tens of cents USD-equivalent when live) before authority mint + airdrop to your wallet. Fake mints / random contracts are scams — only in-game UI.`,
    es: () =>
      `El **mint** es **controlado por el server** (no spam desde el client): solo items elegibles de valor; el farm mid queda en inventario. Hay un fee anti-spam chico (stable y/o $HELL, orden de centavos–décimas de USD cuando esté live) antes del mint de authority + airdrop a tu wallet. Mint fake / contratos random = estafa — solo UI del juego.`,
  },
  {
    keys: [/afk|idle|park|parquear|kick|inactivo/i],
    en: () =>
      `**AFK** free parks burn CCU/RAM — expect warn/kick on free AFK. Long “park online” is designed around a **high $HELL stake** threshold (config TBD in test). Active PvE/PvP is what the stack optimizes for.`,
    es: () =>
      `**AFK** gratis quema cupos/RAM — esperá warn/kick. “Parkear” online largo se diseña con **mucho $HELL staked** (umbral TBD en test). El stack prioriza PvE/PvP activo.`,
  },
  {
    keys: [/solana|why solana|por qu[eé] solana|phantom.?gas|tx fee|gas/i],
    en: () =>
      `We use **Solana** for wallet login + cheap utility (claims, fees, optional item mint) — not to turn every drop into an NFT. Play first; chain when it helps anti-spam / ownership.`,
    es: () =>
      `Usamos **Solana** para login con wallet + utilidad barata (claims, fees, mint opcional de items) — no para mintear cada drop. Primero se juega; chain cuando suma anti-spam / ownership.`,
  },
  {
    keys: [/hell|token|airdrop|precio|price|moon|apy|invert|invest|\$hell|claim credit|cr[eé]ditos/i],
    en: () =>
      `$HELL is **in-game utility** (play-mine credits, shops, sinks, future stake gates) — **not** investment advice. No price targets, no guaranteed airdrop $ value. Test credits may count toward a **possible** future drop (TBD, not guaranteed). Policy nuance → human staff.`,
    es: () =>
      `$HELL es **utilidad in-game** (créditos play-mine, shops, sinks, gates de stake) — **no** es consejo de inversión. Sin targets de precio ni airdrop garantizado en $. Créditos del test pueden contar para un drop **posible** (TBD, sin garantía). Política fina → staff humano.`,
  },
  {
    keys: [/helbreath oficial|official helbreath|licen|siementech|copyright/i],
    en: () =>
      `We're **Helbreath Chain Lords** — classic city-war MMO *feel*, own brand. **Not** an official Helbreath product or licensed remake.`,
    es: () =>
      `Somos **Helbreath Chain Lords** — feel clásico de city-war MMO, marca propia. **No** somos producto oficial de Helbreath ni remake licenciado.`,
  },
  {
    keys: [/discord|invite|invitar|link oficial|community/i],
    en: () => {
      const { site, discord } = links();
      return `Official Discord: ${discord} — site: ${site}`;
    },
    es: () => {
      const { site, discord } = links();
      return `Discord oficial: ${discord} — sitio: ${site}`;
    },
  },
  {
    keys: [/status|online|offline|server|servidor|caido|down|mantenimiento|maintenance/i],
    en: () =>
      `Check **#status** and **#announcements** for official server status. I don't invent uptime or ETAs.`,
    es: () =>
      `Mirá **#status** y **#announcements** para el estado oficial. No invento uptime ni ETAs.`,
  },
  {
    keys: [/class|clase|warrior|mage|priest|combat|build|stats|str|dex|int|vit|mag/i],
    en: () =>
      `Classic Helbreath-style classes/stats — pick what you enjoy for test. Meta will shift; no “guaranteed best build”. Ask #general or #lfg for party advice; report broken skills in #bug-reports.`,
    es: () =>
      `Clases/stats al estilo Helbreath clásico — elegí lo que te divierta en test. El meta cambia; no hay “build garantizada”. Consejos de party en #general / #lfg; skills rotas en #bug-reports.`,
  },
  {
    keys: [/market|auction|ofertas|merien|xelima|marketplace|side.?door|mesa de entrega|delivery desk/i],
    en: () => {
      const { site } = links();
      return `**Market / Auction (mobile side door)**
Browse live offers, ask Grok to fill a buy, pay USDC, claim at the **delivery desk** in-game.
• Web: ${site.replace(/\/$/, '')}/market.html
• Discord: \`/market query: merien stones\`
No combat bots. Staff never asks for seeds.`;
    },
    es: () => {
      const { site } = links();
      return `**Market / Auction (side door mobile)**
Mirá ofertas live, pedile a Grok que arme la compra, pagá USDC, retirás en la **mesa de entrega** in-game.
• Web: ${site.replace(/\/$/, '')}/market.html
• Discord: \`/market query: merien stones\`
Sin bots de combate. Staff nunca pide seeds.`;
    },
  },
  {
    keys: [/scam|estafa|mod dm|staff dm|free sol|airdrop link|conect[aá] ac[aá]/i],
    en: () =>
      `**Scam checklist:** staff never DMs first for seeds, “verify wallet”, or random connect links. Never paste seed anywhere. Official links only from #announcements / site pinned by staff. Report scammers to mods.`,
    es: () =>
      `**Anti-estafa:** el staff nunca te escribe primero pidiendo seed, “verificá wallet” ni links raros. Nunca pegues la seed. Links oficiales solo de #announcements / sitio. Reportá estafadores a los mods.`,
  },
];

export function isSpanish(text) {
  return /[áéíóúñ¿¡]|\b(hola|gracias|como|cómo|qué|que|jugar|ayuda|error|servidor|billetera|mintear|personaje|arena|domingo)\b/i.test(
    text,
  );
}

function resolve(body) {
  return typeof body === 'function' ? body() : body;
}

export function staticFaqReply(userText) {
  const es = isSpanish(userText);
  for (const item of FAQ) {
    if (item.keys.some((re) => re.test(userText))) {
      return resolve(es ? item.es : item.en);
    }
  }
  const { site, discord } = links();
  return es
    ? `Puedo ayudar con: **jugar/test**, **wallet**, **personajes**, **bugs**, **arena**, **mint**, **AFK**, **EK**, **$HELL (solo utilidad)**, **anti-estafa**. Escribí en #support o mencioname. Políticas/cuentas → **mod humano**. Sitio: ${site} · Discord: ${discord}`
    : `I can help with: **play/test**, **wallet**, **characters**, **bugs**, **arena**, **mint**, **AFK**, **EK**, **$HELL (utility only)**, **scam safety**. Write in #support or mention me. Policy/account → **human mod**. Site: ${site} · Discord: ${discord}`;
}

/** Local smoke tests — run: node -e "import('./src/staticFaq.js').then(m=>m.selfTest())" */
export function selfTest() {
  const cases = [
    ['how do I play?', /Play Now|Phantom/i],
    ['como juego?', /Play Now|Phantom|wallet/i],
    ['mint nft fee', /server-controlled|controlado/i],
    ['afk park', /stake|AFK/i],
    ['ek gallery', /Enemy Kill|EK/i],
    ['$HELL moon price', /utility|utilidad|not investment|no es consejo/i],
    ['random question xyz', /I can help|Puedo ayudar/i],
  ];
  let fail = 0;
  for (const [q, re] of cases) {
    const a = staticFaqReply(q);
    const ok = re.test(a);
    console.log(ok ? 'OK' : 'FAIL', JSON.stringify(q), '→', a.slice(0, 80).replace(/\n/g, ' '));
    if (!ok) fail++;
  }
  if (fail) process.exitCode = 1;
  return fail === 0;
}
