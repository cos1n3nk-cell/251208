// 全視窗畫布：背景 #606C38，支援多組動畫集（e5pig, c3, d4, b2）
// - e5pig: 原本的 idle 動畫（10 張，866x31）
// - c3: 跳躍動畫（15 張，970x55），由按上鍵啟動
// - d4: 左右移動動畫（7 張，408x34），由按左/右鍵啟動
// - b2: 下鍵動畫（11 張，666x51）

const ANIM_FPS = 12; // 動畫每秒幀數
let frameInterval = 1000 / ANIM_FPS;
let lastFrameTime = 0;

// 依資料夾預先定義每組的影格（明確列出檔名以避免 404）
const ANIM_SETS = {
  '123c': {
    path: '123c',
    files: ['0.png','1.png','2.png','3.png','4.png','5.png','6.png','7.png','8.png','9.png']
  },
  e5: { 
    path: 'e5pig', 
    files: ['0.png','1.png','2.png','3.png','4.png','7.png','8.png','9.png','10.png','11.png']
  },
  c3: { 
    path: 'c3', 
    files: ['0.png','1.png','2.png','3.png','4.png','5.png','6.png','7.png','8.png','9.png','10.png','11.png','12.png','13.png','14.png']
  },
  d4: { 
    path: 'd4', 
    files: ['0.png','1.png','2.png','3.png','4.png','5.png','6.png']
  },
  b2: { 
    path: 'b2', 
    files: ['0.png','1.png','2.png','3.png','4.png','5.png','6.png','7.png','8.png','9.png','10.png']
  }
  ,
  '122b': {
    path: '122b',
    files: ['0.png','1.png','2.png','3.png','4.png','5.png','6.png','7.png','8.png','9.png','10.png','11.png','12.png','13.png']
  },
  '121a': {
    path: '121a',
    files: ['0.png','1.png','2.png','3.png','4.png','5.png','6.png','7.png','8.png']
  }
};

// 載入後的影格陣列集合
let assets = {
  e5: [],
  c3: [],
  d4: [],
  b2: [],
  '123c': []
};

// 各動畫當前的幀索引（保留各自進度）
let frameIndices = {
  e5: 0,
  c3: 0,
  d4: 0,
  b2: 0,
  '123c': 0
};

// 新增 NPC 動畫 (122b 與 121a)
assets['122b'] = [];
assets['121a'] = [];
frameIndices['122b'] = 0;
frameIndices['121a'] = 0;

// NPC 物件
let npc = {
  x: 0,
  y: 0,
  anim: '122b', // 預設播放 122b
  idle: '122b',
  contact: '121a'
};

// 地面位置（會在 setup 或 windowResized 設定）
let groundY = 0;

// NPC 動畫定時器（獨立於玩家）
let npcLastFrameTime = 0;
const NPC_FPS = 12;
const npcFrameInterval = 1000 / NPC_FPS;

// 對話系統狀態
let dialogActive = false; // 是否正在對話流程中
let npcTyping = false; // NPC (122b) 正在逐字打字
let npcMessage = '找我有什麼事嗎？';
let npcTypedIndex = 0;
const TYPING_SPEED = 40; // 毫秒/字
let lastTypedTime = 0;

// 玩家輸入欄位（p5 DOM）
let playerInput = null;
let sendButton = null;
let playerMessage = '';
let showPlayerBubble = false;

// 改為使用 canvas 輸入（避免 DOM 顯示）
let canvasInputText = '';
let canvasInputActive = false; // 當 NPC 打字完畢，啟動 canvas 輸入


// NPC 回覆（模擬 AI 回覆）
let aiReply = '';
let aiReplyIndex = 0;
let npcReplying = false;

// 對話泡泡設定
const BUBBLE_MAX_W = 320;
const BUBBLE_PADDING = 10;

// 角色位置與移動（初始置中）
let px, py; // 中心座標
let vy = 0; // 垂直速度
let gravity = 0.6;
let jumpSpeed = -12;
let speed = 4; // 水平移動速度

// 朝向（1 = 面向右, -1 = 面向左）
let facing = 1;

// 追蹤上一次按的左/右方向（0 = 沒按, 1 = 右, -1 = 左）
let lastHorizontalDir = 0;
// 追蹤是否正在播放 d4 轉身動畫
let playingTurnAnim = false;

function preload() {
  // 依明確列表載入每組影格
  for (const key in ANIM_SETS) {
    const set = ANIM_SETS[key];
    for (let i = 0; i < set.files.length; i++) {
      assets[key].push(loadImage(set.path + '/' + set.files[i]));
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  noSmooth();
  frameRate(60);

  // 地面與角色起始位置
  groundY = height / 2;
  // 角色起始在畫面正中央（垂直以地面為基準）
  px = width / 2;
  py = groundY;

  // NPC 初始位置（右側三分之一處）
  npc.x = width * 0.75;
  npc.y = groundY;
  // 123c 位置設為與 122b 相對（左側）
  window.c123c_x = width * 0.25;
  window.c123c_y = py; // 與 e5pig 同平面

  // 建立玩家輸入欄位與送出按鈕（預設隱藏）
  playerInput = createInput('');
  playerInput.size(BUBBLE_MAX_W - BUBBLE_PADDING*2, 26);
  // 不要顯示灰色 placeholder（依使用者要求）
  playerInput.attribute('placeholder', '');
  // 隱藏 DOM input，我們改用 canvas 輸入
  playerInput.hide();
  // 讓 input 看起來像在泡泡中：透明背景、無邊框
  playerInput.style('background', 'transparent');
  playerInput.style('border', 'none');
  playerInput.style('outline', 'none');
  playerInput.style('font-size', '16px');
  playerInput.style('padding', '4px');
  playerInput.style('color', '#000');

  sendButton = createButton('送出');
  sendButton.mousePressed(onSend);
  sendButton.hide();
  sendButton.style('font-size', '14px');

  // 我們改為使用 canvas 鍵盤事件處理，不綁定 DOM 事件
}

function draw() {
  background('#606C38');

  // 123c 角色顯示：預設循環 0~6.png，e5pig 靠近時循環 7~9.png（單一動畫，與 122b 一樣模式）
  let c123x = window.c123c_x || width * 0.25;
  let c123y = py;
  let distToE5 = abs(px - c123x);
  let maxDist = width * 0.4;
  let frame = 0;
  let showBubble = false;
  let showFar = false;
  let showNear = false;
  // 判斷 e5pig 是否碰到 123c（以影像寬高簡單包圍盒）
  let pImgE5 = assets['e5'][frameIndices['e5']];
  let cImg = assets['123c'][frame];
  let overlap123c = false;
  if (pImgE5 && cImg) {
    let pw = pImgE5.width, ph = pImgE5.height;
    let cw = cImg.width, ch = cImg.height;
    overlap123c = (Math.abs(px - c123x) * 2 < (pw + cw)) && (Math.abs(py - c123y) * 2 < (ph + ch));
  }
  if (distToE5 < maxDist) {
    // 靠近時循環 0~6.png
    frame = Math.floor((millis()/200)%7);
    showNear = true;
  } else {
    // 沒靠近時循環 0~2.png
    frame = Math.floor((millis()/200)%3);
    showFar = true;
  }
  // 顯示 0~6.png
  let img123c = assets['123c'][frame];
  if (img123c) {
    push();
    translate(c123x, c123y);
    scale(-1, 1);
    image(img123c, 0, -img123c.height/2);
    pop();
  }
  // 7~9.png 平移到右側視窗外
  // 7~9.png 平移動畫狀態
  if (!window.c123c_anim) window.c123c_anim = {t: 0, lastNear: false, attack: false, attackT: 0};
  let anim = window.c123c_anim;
  let frame6Visible = (Math.floor((millis()/200)%7) === 6);
  // 攻擊觸發：e5pig 碰到 123c 時
  if (overlap123c && !anim.attack) {
    anim.attack = true;
    anim.attackT = 0;
  }
  if (!overlap123c) {
    anim.attack = false;
    anim.attackT = 0;
  }
  // 攻擊動畫（7~9.png 連續快速播放一次）
  if (anim.attack) {
    anim.attackT += deltaTime/600; // 更快
    let baseX = c123x;
    let endX = width + 100;
    for (let i = 7; i <= 9; i++) {
      let img = assets['123c'][i];
      if (img) {
        let tx = lerp(baseX, endX, anim.attackT + (i-7)*0.15);
        push();
        translate(tx, c123y);
        scale(-1, 1);
        image(img, 0, -img.height/2);
        pop();
      }
    }
    showBubble = true; // 只有碰撞時顯示泡泡
  }
  // 泡泡只在 9.png 完全移出時出現，且固定在 123c 原始座標
  if (showBubble && overlap123c) {
    const lines = wrapTextToLines('不要靠近我', BUBBLE_MAX_W, 16);
    let imgH = (assets['123c'][9]) ? assets['123c'][9].height : 40;
    drawSpeechBubble(c123x, c123y - imgH/2 - 30, lines);
  }

  // 判斷按鍵（支援同時按）
  const up = keyIsDown(UP_ARROW);
  const down = keyIsDown(DOWN_ARROW);
  const left = keyIsDown(LEFT_ARROW);
  const right = keyIsDown(RIGHT_ARROW);

  // 決定當前水平方向
  let currentHorizontalDir = 0;
  if (left) currentHorizontalDir = -1;
  else if (right) currentHorizontalDir = 1;

  // 檢查是否發生方向改變（例如從按右變成按左，或從按右變成放開）
  // 只有當：(1) 之前有按左/右，(2) 現在改變了，或 (3) 現在改變方向時
  if (currentHorizontalDir !== 0 && currentHorizontalDir !== lastHorizontalDir && lastHorizontalDir !== 0) {
    // 方向改變了（例如從 1 變成 -1，或從 -1 變成 1），播放一次 d4
    playingTurnAnim = true;
    frameIndices['d4'] = 0; // 重置 d4 的幀索引
  }

  // 如果 d4 轉身動畫播放完一遍，就回到 e5
  if (playingTurnAnim && frameIndices['d4'] === 0 && lastFrameTime > 0) {
    // 動畫結束判定：當幀推進回到 0 時
    // （需要額外邏輯來判定「剛好轉過一圈」）
  }

  // 簡化邏輯：如果正在轉身且轉身動畫已播放至最後一幀，標記完成
  // 這邊我們用一個計數器來追蹤 d4 播放的次數
  
  // 決定當前動畫集（優先順序：Up > Down > 轉身中(d4) > idle(e5)）
  let active = 'e5';
  if (up) {
    active = 'c3';
    playingTurnAnim = false;
  }
  else if (down) {
    active = 'b2';
    playingTurnAnim = false;
  }
  else if (playingTurnAnim) {
    active = 'd4';
  }
  else if (left || right) {
    // 持續按左/右但沒有轉身，就用 e5
    active = 'e5';
  }

  // 更新上一次的方向
  lastHorizontalDir = currentHorizontalDir;

  // 水平移動（可與其他鍵並行）
  if (left) {
    px -= speed;
    facing = -1;
  }
  if (right) {
    px += speed;
    facing = 1;
  }

  // 簡單跳躍：當按上鍵時啟動向上速度（只有在地面時才可再次跳）
  // 使用全域 groundY
  // 如果按上就嘗試跳（但避免一直套用初速度）
  if (up && abs(py - groundY) < 0.5 && vy === 0) {
    vy = jumpSpeed;
  }

  // 應用重力與位置更新
  vy += gravity;
  py += vy;

  // 碰地處理
  if (py > groundY) {
    py = groundY;
    vy = 0;
  }

  // 時間驅動的幀更新（每組保有自己的幀索引）
  if (millis() - lastFrameTime >= frameInterval) {
    lastFrameTime = millis();
    // 進到下一幀
    frameIndices[active] = (frameIndices[active] + 1) % assets[active].length;
    
    // 如果 d4 動畫播放完整一圈，結束轉身狀態
    if (playingTurnAnim && active === 'd4' && frameIndices[active] === 0) {
      playingTurnAnim = false;
    }
  }

  // NPC 動畫獨立更新（讓 NPC 的兩組動畫都能持續循環）
  if (millis() - npcLastFrameTime >= npcFrameInterval) {
    npcLastFrameTime = millis();
    if (assets['122b'] && assets['122b'].length > 0) {
      frameIndices['122b'] = (frameIndices['122b'] + 1) % assets['122b'].length;
    }
    if (assets['121a'] && assets['121a'].length > 0) {
      frameIndices['121a'] = (frameIndices['121a'] + 1) % assets['121a'].length;
    }
  }

  // 碰撞偵測（矩形包圍盒，基於當前顯示的影像尺寸）
  // 取得玩家顯示影格（可能為 e5/c3/d4/b2）
  const pImg = assets[active] && assets[active][frameIndices[active]];
  const npcImg = assets[npc.anim] && assets[npc.anim][frameIndices[npc.anim]];
  if (pImg && npcImg) {
    const pw = pImg.width;
    const ph = pImg.height;
    const nw = npcImg.width;
    const nh = npcImg.height;
    const overlap = (Math.abs(px - npc.x) * 2 < (pw + nw)) && (Math.abs(py - npc.y) * 2 < (ph + nh));
    if (overlap) {
      if (npc.anim !== npc.contact) {
        npc.anim = npc.contact;
        // 從頭播放 contact 動畫
        frameIndices[npc.anim] = 0;
      }
      // 啟動對話（若尚未啟動）
      if (!dialogActive) startDialog();
      // 當 NPC 打字完成後，切換為 canvas 輸入模式
      // （由 drawDialog 中在打字完成時設定 canvasInputActive）
    } else {
      if (npc.anim !== npc.idle) {
        npc.anim = npc.idle;
        frameIndices[npc.anim] = 0;
      }
      // 結束對話（若正在對話）
      if (dialogActive) {
        endDialog();
        // 關閉 canvas 輸入
        canvasInputActive = false;
        canvasInputText = '';
      }
    }
  }

  // 取得當前影格
  const img = assets[active][frameIndices[active]];

  // 畫出 NPC（在 npc.x, npc.y） — 先畫 NPC，使玩家疊在上方
  const imgNpc = assets[npc.anim] && assets[npc.anim][frameIndices[npc.anim]];
  if (imgNpc) {
    push();
    translate(npc.x, npc.y);
    image(imgNpc, 0, 0);
    pop();
  }

  // 對話顯示：若 NPC 正在打字或有回覆/玩家氣泡，要在畫面上繪製泡泡
  drawDialog();

  // 畫出角色（在 px,py）
  if (img) {
    push();
    translate(px, py);
    // 水平翻轉以反映朝向
    scale(facing, 1);
    image(img, 0, 0);
    pop();
  } else {
    // 若該組沒影格，顯示提示文字
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Animation "' + active + '" not loaded', width / 2, height / 2);
  }

  // 可選：保持角色在畫布內
  px = constrain(px, 0 + 1, width - 1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新計算地面與 NPC 位置
  groundY = height / 2;
  py = groundY;
  npc.y = groundY;
  // 若輸入欄顯示，重新定位到玩家上方
  if (playerInput && playerInput.style('display') !== 'none') {
    const imgH = (assets['e5'] && assets['e5'][0]) ? assets['e5'][0].height : 40;
    const inputW = BUBBLE_MAX_W - BUBBLE_PADDING*2;
    const estimatedTop = Math.round(py - imgH - 40);
    playerInput.position(Math.round(px - inputW/2 + BUBBLE_PADDING), estimatedTop);
  }
  if (sendButton && sendButton.style('display') !== 'none') {
    const inputW = BUBBLE_MAX_W - BUBBLE_PADDING*2;
    const estimatedTop = Math.round(py - ((assets['e5'] && assets['e5'][0]) ? assets['e5'][0].height : 40) - 40);
    sendButton.position(Math.round(px - inputW/2 + BUBBLE_PADDING) + inputW + 8, estimatedTop);
  }
}

function keyPressed() {
  // 防止瀏覽器滾動箭頭鍵的預設行為
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
    return false; // p5.js 會 preventDefault
  }
  // 在 canvas 輸入模式下，處理 Backspace 與 Enter
  if (canvasInputActive) {
    if (keyCode === BACKSPACE) {
      // 移除最後一個字元
      canvasInputText = canvasInputText.slice(0, -1);
      return false;
    }
    if (keyCode === ENTER || keyCode === RETURN) {
      // 提交文字
      onSend();
      return false;
    }
  }
}

function keyTyped() {
  // 只在 canvas 輸入模式下捕捉可印字元
  if (!canvasInputActive) return;
  // 過濾控制字元
  if (key === '\b' || key === '\r' || key === '\n') return;
  // 限制最大長度（避免過長）
  if (canvasInputText.length < 200) {
    canvasInputText += key;
  }
  return false; // 取消預設
}

// ------------ 對話相關函式 ------------
function startDialog() {
  dialogActive = true;
  npcTyping = true;
  npcTypedIndex = 0;
  lastTypedTime = millis();
  // 隱藏玩家輸入直到 NPC 打字完成
  if (playerInput) playerInput.hide();
  if (sendButton) sendButton.hide();
  showPlayerBubble = false;
  aiReply = '';
  aiReplyIndex = 0;
  npcReplying = false;
}

function endDialog() {
  dialogActive = false;
  npcTyping = false;
  npcTypedIndex = 0;
  if (playerInput) {
    playerInput.hide();
    playerInput.value('');
  }
  if (sendButton) sendButton.hide();
  showPlayerBubble = false;
  aiReply = '';
  npcReplying = false;
}

async function onSend() {
  // 支援從 canvas 提交或 DOM 提交（DOM 被隱藏，但保留支援）
  let txt = '';
  if (canvasInputActive) {
    txt = canvasInputText.trim();
  } else if (playerInput) {
    txt = playerInput.value().trim();
  }
  if (!txt || txt.length === 0) return;
  // 新問題到來：清除舊回覆顯示
  aiReply = '';
  aiReplyIndex = 0;
  npcReplying = false;
  // 設定玩家訊息（不要注音：直接使用玩家原始輸入作為顯示文字）
  playerMessage = txt;
  // 不使用後端回傳的注音，直接把輸入文字顯示在畫布輸入欄
  canvasInputText = txt;
  playerMessage = txt;
  showPlayerBubble = false; // 不顯示玩家泡泡
  // 關閉輸入狀態
  canvasInputActive = false;
  canvasInputText = '';
  if (playerInput) playerInput.hide();
  if (sendButton) sendButton.hide();

  // 呼叫本地 proxy（/api/chat）以取得注音與 GPT 回覆
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: playerMessage })
    });
    if (!resp.ok) {
      const txtErr = await resp.text();
      console.warn('Chat API error', resp.status, txtErr);
      // fallback to local reply
      aiReply = generateAIReply(playerMessage);
    } else {
      const j = await resp.json();
      // j: { zhuyin_input, reply }
      if (j.zhuyin_input) {
        // 顯示中文文字為玩家可見文字（優先使用後端回傳的 chinese_input，若無則以 zhuyin_input 作為 fallback）
        if (j.chinese_input && j.chinese_input.length > 0) {
          canvasInputText = j.chinese_input;
        } else if (j.zhuyin_input) {
          canvasInputText = j.zhuyin_input;
        } else {
          canvasInputText = '';
        }
        canvasInputText = j.zhuyin_input;
      }
      aiReply = j.reply || '';
    }
  } catch (err) {
    console.error('Failed to call /api/chat', err);
    aiReply = generateAIReply(playerMessage);
  }

  // 啟動 NPC 逐字回覆（或顯示立即的回覆）
  aiReplyIndex = 0;
  npcReplying = true;
  lastTypedTime = millis();
}

// 簡單本地 AI 回覆（可替換為遠端 API）
function generateAIReply(q) {
  const s = q.replace(/\s/g, '').toLowerCase();
  if (s.includes('ㄋㄧˇㄐㄧㄠˋㄕㄜˊㄇㄜ˙')) return '你不需要知道';
  if (s.includes('ㄐㄧㄣㄊㄧㄢㄍㄨㄛˋㄉㄜ˙ㄖㄨˊㄏㄜˊ')) return '有你在就是很好的一天';
  if (s.includes('ㄨㄛˇㄏㄣˇㄔㄚㄐㄧㄥˋㄇㄚ')) return '怎麼會！你是最好的';
  if (s.includes('ㄧㄡˇㄖㄣˊㄕㄨㄛㄨㄛˇㄏㄣˇㄆㄤˋ')) return '誰說的 我幫你去揍他';
  if (s.includes('ㄨㄛˇㄇㄣˇㄕˋㄏㄠˇㄆㄥˊㄧㄡˇㄇㄚ')) return '是比好朋友還要好的那種好朋友';
  // 其他問題預設回覆
  return '不跟泥說';
}

// 將文字斷行成符合寬度的多行陣列（支援中文按字分行）
function wrapTextToLines(txt, maxW, textSizeVal) {
  textSize(textSizeVal);
  let lines = [];
  let cur = '';
  for (let i = 0; i < txt.length; i++) {
    cur += txt[i];
    if (textWidth(cur) > maxW - BUBBLE_PADDING*2) {
      // 如果單字也超過，強制斷
      if (cur.length === 1) {
        lines.push(cur);
        cur = '';
      } else {
        // 把最後一個字移到下一行
        const lastChar = cur.slice(-1);
        const line = cur.slice(0, -1);
        lines.push(line);
        cur = lastChar;
      }
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

// 繪製對話泡泡（x,y 為中心點上方位置），lines 為文字陣列
function drawSpeechBubble(cx, cy, lines, alignRight=false) {
  textSize(16);
  const maxLineWidth = (lines && lines.length) ? Math.max(...lines.map(l => textWidth(l))) : 0;
  const w = Math.min(BUBBLE_MAX_W, Math.max(80, maxLineWidth) + BUBBLE_PADDING*2);
  const lineCount = (lines && lines.length) ? lines.length : 1;
  const h = lineCount * (16 + 4) + BUBBLE_PADDING*2;
  let bx = cx - w/2;
  if (alignRight) bx = cx - w/2; // 預留未來調整
  const by = cy - h - 20; // 20 px above the character

  // 限制不要超出畫面
  const bxClamped = constrain(bx, 8, width - w - 8);

  // 背景與邊框
  push();
  fill(255);
  stroke(0);
  rect(bxClamped, by, w, h, 8);
  // 文字
  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  let ty = by + BUBBLE_PADDING;
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], bxClamped + BUBBLE_PADDING, ty);
    ty += 16 + 4;
  }
  pop();
}

// 在畫面上處理並繪製對話（NPC 打字、玩家輸入、AI 回覆）
function drawDialog() {
  // NPC 打字階段
  if (dialogActive && npcTyping) {
    // 逐字更新
    if (millis() - lastTypedTime >= TYPING_SPEED) {
      lastTypedTime = millis();
      if (npcTypedIndex < npcMessage.length) {
        npcTypedIndex++;
      } else {
        // 完成打字，顯示輸入欄於玩家上方（與 122b 泡泡同格式）
        npcTyping = false;
        canvasInputActive = true;
        canvasInputText = '';
        // 清除之前的 AI 顯示（若有），新問題到來前隱藏舊回覆
        aiReply = '';
        aiReplyIndex = 0;
        npcReplying = false;
      }
    }
    const shown = npcMessage.slice(0, npcTypedIndex);
    const lines = wrapTextToLines(shown, BUBBLE_MAX_W, 16);
    drawSpeechBubble(npc.x, npc.y - (assets[npc.anim] && assets[npc.anim][frameIndices[npc.anim]] ? assets[npc.anim][frameIndices[npc.anim]].height/2 : 0), lines);
  }

  // 玩家送出訊息後顯示玩家氣泡
  if (showPlayerBubble) {
    const lines = wrapTextToLines(playerMessage, BUBBLE_MAX_W, 16);
    drawSpeechBubble(px, py - (assets['e5'] && assets['e5'][0] ? assets['e5'][0].height/2 : 0), lines);
  }

  // 玩家正在輸入（尚未送出）時，在玩家上方顯示與 NPC 相同格式的泡泡，並把 input DOM 放到同位置
  // Canvas 輸入模式：以 canvas 文字顯示，不使用 DOM input
  if (dialogActive && !npcTyping && canvasInputActive) {
    const imgH = (assets['e5'] && assets['e5'][0]) ? assets['e5'][0].height : 40;
    const bubbleX = px;
    const bubbleY = py - imgH/2;
    // 直接顯示玩家輸入的繁體字
    const curText = canvasInputText;
    const lines = wrapTextToLines(curText, BUBBLE_MAX_W, 16);
    drawSpeechBubble(bubbleX, bubbleY, lines);
  }

  // NPC 正在回覆（逐字顯示 aiReply）
  if (npcReplying) {
    if (millis() - lastTypedTime >= TYPING_SPEED) {
      lastTypedTime = millis();
      if (aiReplyIndex < aiReply.length) aiReplyIndex++;
      else {
        npcReplying = false; // 完成後停止逐字，並保持回覆顯示直到下一個問題
        // 將 aiReply 保持顯示，直到下一次 startDialog/提交時清除
      }
    }
    const shown = aiReply.slice(0, aiReplyIndex);
    const lines = wrapTextToLines(shown, BUBBLE_MAX_W, 16);
    drawSpeechBubble(npc.x, npc.y - (assets[npc.anim] && assets[npc.anim][frameIndices[npc.anim]] ? assets[npc.anim][frameIndices[npc.anim]].height/2 : 0), lines);
  }
  // 若已完成回覆且 npcReplying 為 false，但 aiReply 有內容，則顯示完整回覆（直到下一次提問）
  else if (!npcReplying && aiReply && aiReply.length > 0) {
    const lines = wrapTextToLines(aiReply, BUBBLE_MAX_W, 16);
    drawSpeechBubble(npc.x, npc.y - (assets[npc.anim] && assets[npc.anim][frameIndices[npc.anim]] ? assets[npc.anim][frameIndices[npc.anim]].height/2 : 0), lines);
  }
}
