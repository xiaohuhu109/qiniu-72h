/**
 * AI 智能场景分析 —— DeepSeek API
 *
 * 将小说文本发送给 DeepSeek，由 AI 理解叙事结构，
 * 返回：场景切分、角色识别、对话提取、地点/时间标注
 *
 * 配置：填入你的 DeepSeek API Key 即可使用
 */

const CONFIG = {
  url: 'https://api.deepseek.com/v1/chat/completions',
  key: 'sk-e837eb21da354467abfff56843a6a770',
  model: 'deepseek-chat',
  timeout: 60000,   // 长文本可能需较长时间
};

/**
 * 检查是否已配置
 */
function isReady() {
  return CONFIG.key && CONFIG.key.length > 10;
}

/**
 * 系统提示词：告诉 AI 它的任务和输出格式
 */
const SYSTEM_PROMPT = `你是一个专业的小说分析和剧本改编助手。请将用户提供的小说文本转换为结构化剧本格式。

## 场次划分规则（重要）

判断一个新场次的开始，必须满足以下条件之一：

1. **地点变更** - 角色从 A 地点移动到 B 地点（如：从"客厅"到"厨房"）
2. **时间跳跃** - 明显的时间流逝（如："第二天"、"几小时后"、"傍晚"→"深夜"）
3. **场景切换** - 叙事视角切换到不同空间（如：从"主角房间"切换到"反派基地"）

**不要拆分的情况：**
- 同一地点的连续对话
- 短暂的沉默或动作停顿
- 同一空间内的不同人物互动

## 输出格式

输出严格的 JSON 格式（不要输出任何 JSON 之外的文字）：

{
  "title": "从文本中提取的小说标题（取第一章节标题，没有则用首行大意，限20字）",
  "scenes": [
    {
      "scene_id": 1,
      "location": "场景地点（如：大殿、街道、书房，限15字）",
      "env_type": "内景 或 外景",
      "time": "时间（如：清晨、上午、午后、傍晚、夜晚、深夜）",
      "primary_character": "本场最主要角色名（发言最多或视角人物）",
      "characters": ["角色1", "角色2", "角色3"],
      "action": "本场景关键动作摘要，限80字，概括发生了什么",
      "dialogues": [
        {"character": "角色名", "text": "对话内容"},
        {"character": "角色名", "text": "对话内容"}
      ]
    }
  ]
}

## 规则

- 场次数目：短篇（<3000字）3-5场，中篇（3000-10000字）5-12场，长篇（>10000字）10-20场
- 同一地点的连续对话必须合并为一场
- 对话不超过本场核心内容，最多取 8 句关键对白
- 如果某句对话没有明确说话人，character 填 "未知"
- 地点、时间如果无法判断，填 "未知"
- JSON 必须合法，不要有注释或额外文字
- scene_id 必须从 1 开始递增`;

/**
 * 调用 DeepSeek API 分析小说
 * @param {string} novelText - 小说全文
 * @returns {Promise<object>} - { title, scenes: [...] }
 */
function analyzeNovel(novelText) {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject(new Error('未配置 API Key'));
      return;
    }

    // 截断过长文本（DeepSeek 上下文 128K，保留足够余量）
    const truncated = novelText.length > 60000
      ? novelText.slice(0, 60000) + '\n\n[文本过长已截断]'
      : novelText;

    wx.request({
      url: CONFIG.url,
      method: 'POST',
      timeout: CONFIG.timeout,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.key}`
      },
      data: {
        model: CONFIG.model,
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请分析以下小说文本：\n\n${truncated}` }
        ]
      },
      success: res => {
        if (res.statusCode !== 200) {
          reject(new Error(`API 错误 ${res.statusCode}: ${JSON.stringify(res.data)}`));
          return;
        }
        try {
          const content = res.data.choices[0].message.content;
          // 尝试从回复中提取 JSON（AI 有时会在 JSON 外包 markdown 代码块）
          let jsonStr = content.trim();
          const mdMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (mdMatch) jsonStr = mdMatch[1].trim();

          const result = JSON.parse(jsonStr);
          if (!result.scenes || !Array.isArray(result.scenes)) {
            reject(new Error('AI 返回数据格式异常'));
            return;
          }
          resolve(result);
        } catch (e) {
          console.error('[AI] 解析失败:', e, '原始:', res.data);
          reject(new Error('AI 返回内容解析失败，请重试'));
        }
      },
      fail: err => {
        console.error('[AI] 请求失败:', err);
        if (err.errMsg && err.errMsg.includes('timeout')) {
          reject(new Error('请求超时，文本可能过长'));
        } else {
          reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`));
        }
      }
    });
  });
}

/**
 * 将 AI 返回结果转换为 util.generateBookFromText 兼容的格式
 * （可直接写入 storage 作为 book 对象）
 */
function convertToBook(aiResult, mode, originalText) {
  const scenes = (aiResult.scenes || []).map((s, i) => {
    const dialogueText = (s.dialogues || [])
      .map(d => (d.character || '未知') + '：' + (d.text || ''))
      .join('\n');

    const scene = {
      scene_id: i + 1,
      title: `场景 ${i + 1}`,
      location: s.location || '未知地点',
      env_type: s.env_type || '内景',
      time: s.time || '白天',
      character: s.primary_character || '旁白',
      characters: s.characters || [s.primary_character].filter(Boolean),
      action: s.action || '场景推进中',
      dialogue: dialogueText || '...',
      yaml: ''
    };

    // 生成 YAML（与 util.generateYaml 一致）
    const charList = scene.characters && scene.characters.length > 0
      ? scene.characters.join(', ')
      : scene.character;

    const lines = [
      `script_id: ${scene.scene_id}`,
      'scene_info:',
      `  location: ${scene.location}`,
      `  env_type: ${scene.env_type}`,
      `  time: ${scene.time}`,
      `character: ${scene.character}`,
      `characters: [${charList}]`,
    ];
    if (mode === 'full') {
      lines.push(`action: ${scene.action}`);
    }
    const dlg = scene.dialogue.replace(/\n/g, '\n  ');
    lines.push(`dialogue: ${dlg}`);
    scene.yaml = lines.join('\n');

    return scene;
  });

  const characters = [];
  const charSet = new Set();
  scenes.forEach(s => {
    (s.characters || []).forEach(c => {
      if (c && !charSet.has(c) && c !== '未知') {
        charSet.add(c);
        characters.push(c);
      }
    });
    // 也加上 primary_character
    if (s.primary_character && !charSet.has(s.primary_character) && s.primary_character !== '未知') {
      charSet.add(s.primary_character);
      characters.push(s.primary_character);
    }
  });

  return {
    id: `book_${Date.now()}`,
    title: aiResult.title || '未命名小说',
    created_at: Date.now(),
    mode,
    characters,
    scenes,
    originalText: originalText  // 保存小说原文，用于对照
  };
}

module.exports = {
  CONFIG,
  isReady,
  analyzeNovel,
  convertToBook
};
