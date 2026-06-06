const STORAGE_KEY = 'novel2script_books';

/**
 * 从本地存储加载所有剧本
 */
function loadBooks() {
  const data = wx.getStorageSync(STORAGE_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * 保存所有剧本到本地存储
 */
function saveBooks(books) {
  wx.setStorageSync(STORAGE_KEY, books);
  return books;
}

/**
 * 从文本第一行提取标题
 */
function generateTitleFromText(text) {
  const firstLine = text.trim().split(/\r?\n/).find(line => line.trim());
  if (!firstLine) return '未命名小说';
  return firstLine.trim().slice(0, 18).replace(/[\s\r\n]+/g, ' ');
}

/**
 * 规范化文本（统一换行符，压缩多余空行）
 */
function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 从文本片段猜测场景信息（地点、内外景、时间）
 */
function guessSceneInfo(segment) {
  const info = { location: '未知地点', env_type: '内景', time: '白天' };

  const locationMatch = segment.match(/(?:地点|场景|在)(?:[:：\s])?([^\n，。；]+?)(?:[，。；\n]|$)/);
  if (locationMatch) {
    info.location = locationMatch[1].trim();
  } else {
    const fallback = segment.match(/(?:在|到)([^，。；\n]+?)(?:[，。；\n]|$)/);
    if (fallback) info.location = fallback[1].trim();
  }

  const timeMatch = segment.match(/(夜晚|晚上|傍晚|清晨|凌晨|早晨|上午|中午|下午|白天|黄昏)/);
  if (timeMatch) info.time = timeMatch[1];

  if (/(外景|街道|公园|广场|天台|海边|山[丘]?|野外|森林|河边|走廊|阳台)/.test(segment)) {
    info.env_type = '外景';
  }

  return info;
}

/**
 * 从段落中提取角色、台词、动作
 */
function extractSceneText(segment) {
  const lines = segment.split('\n').map(line => line.trim()).filter(Boolean);
  const text = lines.join(' ');
  let character = '旁白';
  let dialogue = text;
  let action = '';

  // 尝试匹配 "角色名：台词" 格式
  const talkMatch = segment.match(/([^\n：:]{1,8})[：:](.+)/);
  if (talkMatch) {
    character = talkMatch[1].trim();
    dialogue = talkMatch[2].trim();
  } else if (lines.length > 0) {
    const sentence = lines[0];
    if (sentence.length <= 30) {
      character = '旁白';
      dialogue = sentence;
    }
  }

  // 提取动作
  const actionMatch = segment.match(
    /(?:他|她|[一-龥]{2,4})(?:\s*)?(?:坐|站|走|拿|看|听|走进|走出|转身|凝视|离开|靠近)([^。！!?，,\n]*)/
  );
  if (actionMatch) {
    action = actionMatch[0].trim();
  } else {
    const possibleAction = lines.slice(1).find(
      line => /(?:坐|站|走|拿|看|听|走进|离开|转身|凝视|靠近)/.test(line)
    );
    if (possibleAction) action = possibleAction;
  }

  action = action || '静静地观察着周围';
  dialogue = dialogue || '...';

  return { character, dialogue, action };
}

/**
 * 生成单场 YAML 文本
 */
function generateYaml(scene, mode) {
  const lines = [
    `script_id: ${scene.scene_id}`,
    'scene_info:',
    `  location: ${scene.location}`,
    `  env_type: ${scene.env_type}`,
    `  time: ${scene.time}`,
    `character: ${scene.character}`
  ];
  if (mode === 'full') {
    lines.push(`action: ${scene.action}`);
  }
  lines.push(`dialogue: ${scene.dialogue}`);
  return lines.join('\n');
}

/**
 * 按段落拆分文本
 */
function splitSegments(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
}

/**
 * 从文本中提取所有角色名
 */
function extractCharacters(text) {
  const names = new Set();
  const matches = text.match(/([^\n：:]{1,8})[：:]/g) || [];
  matches.forEach(raw => {
    const name = raw.replace(/[：:]/, '').trim();
    if (name && name.length <= 6) names.add(name);
  });
  return Array.from(names);
}

/**
 * 核心：从文本生成完整剧本对象
 */
function generateBookFromText(text, mode) {
  const title = generateTitleFromText(text);
  const segments = splitSegments(text);
  const scenes = segments.map((segment, index) => {
    const info = guessSceneInfo(segment);
    const textData = extractSceneText(segment);
    const scene = {
      scene_id: index + 1,
      title: `场景 ${index + 1}`,
      location: info.location,
      env_type: info.env_type,
      time: info.time,
      character: textData.character,
      action: textData.action,
      dialogue: textData.dialogue,
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

/**
 * 导出文本文件
 */
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
        success() {
          wx.showToast({ title: '导出成功', icon: 'success' });
        },
        fail() {
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      });
    },
    fail() {
      wx.showToast({ title: '写入失败', icon: 'none' });
    }
  });
}

/**
 * 从 YAML 文本解析 character 字段
 */
function parseYamlCharacter(yamlText) {
  const match = yamlText.match(/^character:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

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
