const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn('Warning: OPENAI_API_KEY not set in environment. The /api/chat endpoint will fail without it.');
}

// POST /api/chat
// body: { message: string }
// returns JSON: { zhuyin_input: string, reply: string }
app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'missing message' });
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });

  try {
    // Request: ask model to return JSON with zhuyin_input and reply
    const systemPrompt = `你是用中文回覆的助理。當收到使用者訊息時，請回傳一個嚴格的 JSON 字串（不要額外文字，僅輸出 JSON）格式如下：
{ "zhuyin_input": "...", "reply": "..." }
其中 zhuyin_input 是將使用者原始輸入轉為臺灣注音符號（注音，例："你好" -> "ㄋㄧˇ ㄏㄠˇ"），reply 是你針對使用者問題的回答（中文）。請確保 JSON 可被解析。`;

    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User message: "${message.replace(/"/g, '\\"')}"` }
      ],
      temperature: 0.7,
      max_tokens: 600
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('OpenAI error', r.status, errText);
      return res.status(500).json({ error: 'OpenAI API error', detail: errText });
    }

    const data = await r.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

    // 嘗試從 model 回傳中解析 JSON
    let parsed = null;
    try {
      // 找到第一個 { 開始到最後一個 } 區段進行解析（容錯）
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        const jsonStr = text.slice(first, last + 1);
        parsed = JSON.parse(jsonStr);
      }
    } catch (err) {
      console.warn('Failed to parse JSON from model response:', err.message);
    }

    if (!parsed) {
      // 回傳降級：把整個 model 文字作為 reply，zhuyin_input 留空
      return res.json({ zhuyin_input: '', reply: text });
    }

    return res.json({ zhuyin_input: parsed.zhuyin_input || '', reply: parsed.reply || '' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', detail: err.message });
  }
});

// 靜態伺服器前端（選擇性）
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}. Visit http://localhost:${PORT}`);
});
