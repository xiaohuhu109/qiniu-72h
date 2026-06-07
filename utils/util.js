const STORAGE_KEY = 'novel2script_books';

/* =========================== 存储 =========================== */

function loadBooks() {
  const data = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(data) ? data : [];
}

function saveBooks(books) {
  wx.setStorageSync(STORAGE_KEY, books);
  return books;
}

/* =========================== 文本规范化 =========================== */

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/* =========================== 标题提取 =========================== */

function generateTitleFromText(text) {
  // 优先取第一个章节标题
  const chMatch = text.match(/(?:第[一二三四五六七八九十百千\d]+[章节回卷][^\n]*)/);
  if (chMatch) return chMatch[1] ? chMatch[1].trim() : chMatch[0].trim().slice(0, 20);
  // 否则取第一行有意义文字
  const first = text.trim().split(/\r?\n/).find(l => l.trim().length > 4);
  return first ? first.trim().slice(0, 20) : '未命名小说';
}

/* =========================== 智能场景切分 =========================== */

/**
 * 检测是否是章节标题行
 * 匹配：第X章、Chapter X、第X节、第X回 等
 */
function isChapterHeader(line) {
  return /^\s*(第[一二三四五六七八九十百千\d]+[章节回卷部]|Chapter\s*\d+|CHAPTER\s*\d+|第[一二三四五六七八九十\d]+[节回])\b/.test(line);
}

/**
 * 检测是否是场景分隔符（***、---、＊ ＊ ＊ 等）
 */
function isSceneBreak(line) {
  return /^\s*[-*＊·•]{3,}\s*$/.test(line) || /^\s*[＊*]\s*[＊*]\s*[＊*]\s*$/.test(line);
}

/**
 * 检测是否包含地点切换信号
 * "来到XX"、"走进XX"、"回到XX"、"XX，一处…"
 */
function isLocationChange(line) {
  return /(?:来到|走进|走入|回到|前往|抵达|到达|步入|跨入|踏入|赶赴|奔赴|转场)[^，。；\n]{2,12}(?:[，。；]|$)/.test(line) ||
         /^(?:画面|镜头)[切换转][^，。；\n]*/.test(line);
}

/**
 * 检测是否包含时间跳跃信号
 * "第二天"、"几日后"、"当晚"、"转眼" 等
 */
function isTimeJump(line) {
  return /^\s*(?:第二天|次日|第二日|第三天|几天后|几日后|数日后|数天后|当晚|是夜|清晨|次日清晨|第二天一早|黄昏时分|夜深|转眼|一晃|时光|光阴|半年后|一年后|数月后|不久后|过了一会儿|片刻之后|须臾|俄顷)/.test(line);
}

/**
 * 核心：智能切分场景
 *
 * 策略（按优先级）：
 *   章节标题       → 强制新场景
 *   分隔符 ***     → 强制新场景
 *   地点切换       → 新场景
 *   时间跳跃       → 新场景
 *   大段空白       → 可能新场景（3+ 空行）
 *   其余           → 合并到当前场景
 *
 * 后处理：
 *   合并过短场景（< 120 字符）
 */
function splitScenes(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // 按段落拆分（段落 = 由 1+ 空行分隔的文本块）
  const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];

  // 第一轮：按边界把段落归入不同场景
  const rawScenes = [];
  let current = [paragraphs[0]];

  for (let i = 1; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const prevBlock = current[current.length - 1] || '';

    // 判断是否需要新场景
    const newScene =
      isChapterHeader(para) ||
      isSceneBreak(prevBlock) ||
      isSceneBreak(para) ||
      isLocationChange(para) ||
      isTimeJump(para);

    if (newScene) {
      rawScenes.push(current.join('\n'));
      current = [para];
    } else {
      current.push(para);
    }
  }
  rawScenes.push(current.join('\n'));

  // 第二轮：合并过短的场景
  return mergeShortScenes(rawScenes.filter(s => s.trim().length > 0));
}

/**
 * 将过短场景（< 120 字符）合并到相邻场景
 */
function mergeShortScenes(scenes) {
  if (scenes.length <= 1) return scenes;

  const MIN_LEN = 120;
  const merged = [];
  let buffer = '';

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i].trim();
    if (s.length === 0) continue;

    if (buffer && buffer.length + s.length < MIN_LEN * 2) {
      // 当前场景和缓冲都很短，合并
      buffer = buffer + '\n\n' + s;
      continue;
    }

    if (buffer && buffer.length < MIN_LEN) {
      // 缓冲太短，和当前场景合并
      buffer = buffer + '\n\n' + s;
      continue;
    }

    // 缓冲够了，提交
    if (buffer) merged.push(buffer);
    buffer = s;
  }

  if (buffer) merged.push(buffer);
  return merged;
}

/* =========================== 场景分析 =========================== */

/**
 * 从场景文本中找出主要角色
 * 策略：
 *   1. 统计所有 "XX说/道/问/：" 模式的发言次数
 *   2. 统计人物名出现频率
 *   3. 发言最多者为该场景主角
 *   4. 无对话场景 → 分析叙事主语
 */
function findPrimaryCharacter(sceneText) {
  // 模式1：XX说/道/问/回答/笑/喊/叫/骂/吼/叹/喝/嚷
  const speakPattern = /([^\s，。；：""'、！!？?\n]{1,6})(?:轻声|冷冷|淡淡|忽然|突然|笑着|哭着|大声|小声|低声)?(?:说|道|问|回答|答道|问道|说道|讲|喊|叫|骂|吼|叹|喝|嚷|惊呼|开口|出声|发言)/g;

  // 模式2：XX："..."
  const colonPattern = /([^\s，。；\n]{1,8})：(?:[""'])/g;

  // 模式3："..." XX 道/说
  const postPattern = /(?:[""'])[^""']*(?:[""'])\s*([^\s，。；\n]{1,6})(?:说|道|问)/g;

  const counts = {};

  function add(name) {
    const n = name.replace(/[""''：:，。\s]/g, '').trim();
    if (n && n.length >= 1 && n.length <= 6 && !/^(?:他|她|它|你|我|这|那|的|了|是|在|不|一|个|人|有|大|来|上|中|下|出|可以|没有|什么|怎么|为什么|自己|他们|我们|你们|她们)$/.test(n)) {
      counts[n] = (counts[n] || 0) + 1;
    }
  }

  let match;
  while ((match = speakPattern.exec(sceneText)) !== null) add(match[1]);
  while ((match = colonPattern.exec(sceneText)) !== null) add(match[1]);
  while ((match = postPattern.exec(sceneText)) !== null) add(match[1]);

  // 排序取最高频
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : '';
}

/**
 * 提取场景中所有对话行
 * 返回带角色标注的对话文本
 */
function extractAllDialogue(sceneText) {
  const lines = sceneText.split('\n');
  const dialogues = [];

  // 多模式匹配对话
  const patterns = [
    // "XX说："...""
    /([^\s，。；\n]{1,8}(?:轻声|冷冷|淡淡|忽然|突然|笑着|哭着|大声|小声|低声)?(?:说|道|问|回答|答道|问道|说道|讲|喊|叫|骂)[：:]\s*[""']?)([^""'\n]+)/g,
    // XX："..."
    /([^\s，。；\n]{1,8})：[""']([^""'\n]+)[""']/g,
    // "..." XX 说/道
    /[""']([^""']+)[""']\s*([^\s，。；\n]{1,6})(?:说|道|问)/g,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;

    // 检测引号对话
    const quoteMatch = trimmed.match(/[""']([^""']{2,})[""']/);
    if (quoteMatch) {
      // 尝试找到说话人
      const before = trimmed.slice(0, quoteMatch.index).trim();
      const after = trimmed.slice(quoteMatch.index + quoteMatch[0].length).trim();

      let speaker = '';
      const beforeName = before.match(/([^\s，。；：]{1,6})\s*$/);
      const afterName = after.match(/^\s*([^\s，。；：]{1,6})(?:说|道|问|轻声|冷冷|淡淡|忽然|突然|笑着|哭着)/);

      if (beforeName) speaker = beforeName[1].replace(/[：:]/g, '');
      else if (afterName) speaker = afterName[1];

      dialogues.push({
        character: speaker || '未知',
        text: quoteMatch[1]
      });
    } else {
      // 检测 "XX：对话内容" 格式（无引号）
      const colonMatch = trimmed.match(/^([^\s，。；：]{1,8})[：:]\s*(.{2,})$/);
      if (colonMatch && colonMatch[2].length > 2) {
        dialogues.push({
          character: colonMatch[1],
          text: colonMatch[2].replace(/[""']/g, '')
        });
      }
    }
  }

  return dialogues;
}

/**
 * 提取叙事摘要（排除对话后的纯叙事文字概要）
 */
function extractNarrativeSummary(sceneText, dialogues) {
  let text = sceneText;

  // 移除所有对话相关行
  dialogues.forEach(d => {
    text = text.replace(d.text, '');
  });

  // 移除 "XX说/道/：" 结构
  text = text.replace(/[^\s，。；\n]{1,8}(?:轻声|冷冷|淡淡|忽然|突然|笑着|哭着)?(?:说|道|问|回答|答道|问道|说道|讲|喊)[：:]\s*/g, '');
  text = text.replace(/[^\s，。；\n]{1,8}[：:]\s*/g, '');
  text = text.replace(/[""']/g, '');
  text = text.replace(/\n{2,}/g, '\n').trim();

  // 取前 100 个有效字符作为动作摘要
  const cleanLines = text.split('\n').filter(l => l.trim().length > 4);
  const summary = cleanLines.slice(0, 3).join('；');
  return summary.slice(0, 120) || '场景推进中';
}

/**
 * 推测场景地点、内外景、时间
 */
function guessSceneInfo(sceneText) {
  const firstPara = sceneText.split('\n')[0] || '';
  const info = { location: '未知地点', env_type: '内景', time: '白天' };

  // ── 地点识别 ──
  const locPatterns = [
    /(?:在|来到|走进|走入|回到|前往|抵达|到达)([^，。；\n]{2,10})(?:[，。；\n]|$)/,
    /(?:地点|场景|位置)[：:]\s*([^\n，。]+)/,
    /([一-龥]{2,4}(?:殿|堂|厅|室|院|阁|楼|房|庙|寺|观|宫|府|城|镇|村|山|谷|林|河|湖|海|塔|园|街|道|巷|桥|台|亭|坊|铺|店|馆|舍|居|处|峰|岭|崖|洞|窟|原|野|漠|岛|舟|船|车|舱|厅|吧|廊|场|门|口|边|畔|前|旁|下|中|里|内|外|上)))/,
  ];

  for (const pat of locPatterns) {
    const m = sceneText.match(pat);
    if (m && m[1] && m[1].trim().length >= 2) {
      info.location = m[1].trim().slice(0, 12);
      break;
    }
  }

  // ── 时间识别 ──
  const timePriority = [
    '凌晨', '清晨', '早晨', '早上', '上午', '中午', '下午', '傍晚', '黄昏',
    '夜晚', '晚上', '深夜', '半夜', '午夜', '白天', '正午', '午后', '入夜', '黎明'
  ];
  for (const t of timePriority) {
    if (sceneText.includes(t)) { info.time = t; break; }
  }

  // ── 内外景识别 ──
  if (/(?:外景|户外|野外|街道|广场|天台|海边|山[脚顶腰]|森林|河边|湖畔|草原|沙漠|花园|公园|庭院|走廊|阳台|码头|旷野|郊外|露天|室外)/.test(sceneText)) {
    info.env_type = '外景';
  }

  return info;
}

/**
 * 分析一个场景：返回角色、对话、动作、场景信息
 */
function analyzeScene(sceneText) {
  const info = guessSceneInfo(sceneText);
  const primary = findPrimaryCharacter(sceneText);
  const dialogues = extractAllDialogue(sceneText);

  // 组装对话文本
  let dialogueText;
  if (dialogues.length > 0) {
    dialogueText = dialogues
      .map(d => (d.character ? d.character + '：' : '') + d.text)
      .join('\n');
  } else {
    // 无对话场景：取前几句叙事作为"台词/旁白"
    const lines = sceneText.split('\n').filter(l => l.trim().length > 6);
    dialogueText = lines.slice(0, 5).join(' ').slice(0, 200) || '...';
  }

  const action = extractNarrativeSummary(sceneText, dialogues);
  const character = primary || '旁白';

  return { character, dialogue: dialogueText, action, location: info.location, env_type: info.env_type, time: info.time };
}

/* =========================== 角色提取 =========================== */

function extractCharacters(fullText) {
  const names = new Set();

  // 模式1：XX 说/道/问/回答
  const speakPat = /([^\s，。；：""'、！!？?\n]{1,6})(?:说|道|问|回答|答道|问道|说道|讲|喊|叫|骂|吼|叹|喝|嚷)/g;
  let m;
  while ((m = speakPat.exec(fullText)) !== null) {
    const n = m[1].replace(/[""''：:，。\s]/g, '').trim();
    if (n && n.length >= 1 && n.length <= 6 &&
      !/^(?:他|她|它|你|我|这|那|的|了|是|在|不|一|个|人|有|大|来|上|中|下|出|可以|没有|什么|怎么|为什么|自己|他们|我们|你们|她们|这个|那个|哪个)$/.test(n)) {
      names.add(n);
    }
  }

  // 模式2：XX："
  const colonPat = /([^\s，。；\n]{1,8})：[""']/g;
  while ((m = colonPat.exec(fullText)) !== null) {
    const n = m[1].replace(/[""''，。\s]/g, '').trim();
    if (n && n.length >= 1 && n.length <= 6 &&
      !/^(?:他|她|它|你|我|这|那|的|了|是|在|不|一|个|人|有|大|来)$/.test(n)) {
      names.add(n);
    }
  }

  return Array.from(names);
}

/* =========================== YAML 生成 =========================== */

function generateYaml(scene, mode) {
  const lines = [
    `script_id: ${scene.scene_id}`,
    'scene_info:',
    `  location: ${scene.location}`,
    `  env_type: ${scene.env_type}`,
    `  time: ${scene.time}`,
    `character: ${scene.character}`,
  ];
  if (mode === 'full') {
    lines.push(`action: ${scene.action}`);
  }
  // dialogue 内容可能有换行，保持缩进
  const dlg = scene.dialogue.replace(/\n/g, '\n  ');
  lines.push(`dialogue: ${dlg}`);
  return lines.join('\n');
}

/* =========================== 主流程 =========================== */

function generateBookFromText(text, mode) {
  const title = generateTitleFromText(text);
  const scenesText = splitScenes(text);

  const scenes = scenesText.map((sceneText, index) => {
    const analysis = analyzeScene(sceneText);
    const scene = {
      scene_id: index + 1,
      title: `场景 ${index + 1}`,
      location: analysis.location,
      env_type: analysis.env_type,
      time: analysis.time,
      character: analysis.character,
      action: analysis.action,
      dialogue: analysis.dialogue,
      yaml: ''
    };
    scene.yaml = generateYaml(scene, mode);
    return scene;
  });

  const characters = extractCharacters(text);

  return {
    id: `book_${Date.now()}`,
    title,
    created_at: Date.now(),
    mode,
    characters,
    scenes
  };
}

/* =========================== 文件导出 =========================== */

function downloadTextFile(filename, content) {
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/${filename}`;
  fs.writeFile({
    filePath,
    data: content,
    encoding: 'utf8',
    success() {
      wx.saveFile({
        tempFilePath: filePath,
        success() { wx.showToast({ title: '导出成功', icon: 'success' }); },
        fail()    { wx.showToast({ title: '导出失败', icon: 'none' }); }
      });
    },
    fail() { wx.showToast({ title: '写入失败', icon: 'none' }); }
  });
}

function parseYamlCharacter(yamlText) {
  const match = yamlText.match(/^character:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

/* =========================== 导出 =========================== */

module.exports = {
  loadBooks,
  saveBooks,
  generateBookFromText,
  generateTitleFromText,
  downloadTextFile,
  parseYamlCharacter,
  extractCharacters,
  generateYaml
};
