/**
 * 文本清洗工具 —— 本地规则 + AI 智能清洗
 *
 * 【本地清洗】免费、秒级，处理 95% 的网页粘贴乱码
 * 【AI 清洗】  需配置 API，精准识别并剔除页头/导航/广告/推荐等无关内容
 */

// ==================== AI 配置 ====================
// 如需 AI 清洗，请填写你的 API 信息
const AI_CONFIG = {
  enabled: false,                        // 改为 true 启用
  url: 'https://api.anthropic.com/v1/messages',  // API 地址
  key: '',                               // API Key
  model: 'claude-haiku-4-5-20251001',   // 推荐轻量模型，成本低速度快
  // 其他兼容 OpenAI 格式的 API 示例：
  // url:  'https://api.deepseek.com/v1/chat/completions'
  // key:  'sk-xxxx'
  // model: 'deepseek-chat'
};

// ==================== 本地清洗 ====================

/**
 * HTML 实体解码
 */
function decodeHTMLEntities(text) {
  const entities = [
    ['&amp;',  '&'],
    ['&lt;',   '<'],
    ['&gt;',   '>'],
    ['&nbsp;', ' '],
    ['&quot;', '"'],
    ['&apos;', "'"],
    ['&#39;',  "'"],
    ['&mdash;', '——'],
    ['&ndash;', '–'],
    ['&hellip;', '…'],
    ['&ldquo;', '"'],
    ['&rdquo;', '"'],
    ['&lsquo;', "'"],
    ['&rsquo;', "'"],
    ['&middot;', '·'],
    ['&times;', '×'],
    ['&trade;', '™'],
    ['&reg;',  '®'],
    ['&copy;', '©'],
  ];
  let result = text;
  entities.forEach(([entity, char]) => {
    result = result.split(entity).join(char);
  });
  // 数字字符引用 &#数字; 或 &#x十六进制;
  result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

/**
 * 移除 HTML / XML 标签
 */
function stripTags(text) {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // 脚本
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // 样式
    .replace(/<[^>]+>/g, '')                             // 所有标签
    .replace(/<\/[^>]+>/g, '');                          // 残留闭合标签
}

/**
 * 移除零宽字符和控制字符
 */
function removeInvisibleChars(text) {
  return text
    .replace(/[​-‍﻿]/g, '')   // 零宽空格/连字符/BOM
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // 控制字符（保留 \t \n）
    .replace(/ /g, ' ');                 // 不间断空格 → 普通空格
}

/**
 * 规范化空格和换行
 */
function normalizeWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')                  // 多个空格/Tab → 单个空格
    .replace(/^[ \t]+/gm, '')                 // 行首空白
    .replace(/[ \t]+$/gm, '')                 // 行尾空白
    .replace(/\n{3,}/g, '\n\n')              // 多余空行压缩
    .trim();
}

/**
 * 剔除网页常见无关行
 * 匹配：导航、面包屑、版权、广告、推荐、评论、页码等
 */
const JUNK_PATTERNS = [
  /^(首页|主页|返回首页|回到顶部|TOP|回到顶部|上一篇|下一篇)$/,
  /^(登录|注册|退出|登录\/注册|Sign\s*in|Log\s*in|Log\s*out)$/i,
  /^(搜索|Search|搜索…|请输入|热门搜索|大家都在搜).*$/,
  /^版权所有|Copyright\s*©|All\s*Rights?\s*Reserved/i,
  /^第[一二三四五六七八九十\d]+[章节回]?\s*$/,
  /^[\(（]?[第]?[一二三四五六七八九十\d]{1,5}[章节回卷]?[\)）]?\s*$/,
  /^[-=*_]{4,}$/,                              // 分隔线
  /^来源[：:]\s*\S+$/,
  /^作者[：:]\s*\S+$/,
  /^时间[：:]\s*\S+$/,
  /^阅读[：:]\s*\d+$/,
  /^字数[：:]\s*\S+$/,
  /^(分享到|分享至|Share|点赞|收藏|转发|评论|浏览).*$/,
  /^(推荐阅读|相关文章|热门文章|猜你喜欢|为您推荐).*$/,
  /^(广告|AD|推广|赞助).*$/,
  /^加载中|Loading|正在加载.*$/i,
  /^(上一篇|下一篇|返回目录|加入书签|书签|目录|书架).*$/,
  /^(←|→|«|»|‹|›)\s*\S*$/,
  /^[┃|｜║│]?\s*$/,
];

/**
 * 判断单行是否为"纯小说正文"
 * 正文特征：长度 > 15 且不是明显的导航/页头/页脚
 */
function looksLikeContent(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;      // 空行保留
  if (trimmed.length <= 1) return null;       // 单字符丢弃
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  return true;
}

/**
 * 批量行级过滤
 */
function filterLines(lines) {
  const result = [];
  let prevEmpty = false;
  for (const line of lines) {
    const verdict = looksLikeContent(line);
    if (verdict === false) continue;           // 明确是垃圾行，丢弃
    const isEmpty = line.trim().length === 0;
    if (isEmpty && prevEmpty) continue;        // 连续空行只保留一个
    result.push(line);
    prevEmpty = isEmpty;
  }
  return result;
}

/**
 * 主入口：本地清洗
 * @param {string} rawText - 原始文本
 * @returns {string} 清洗后文本
 */
function cleanLocal(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;
  text = decodeHTMLEntities(text);
  text = stripTags(text);
  text = removeInvisibleChars(text);
  text = normalizeWhitespace(text);
  const lines = text.split('\n');
  const filtered = filterLines(lines);
  return filtered.join('\n').trim();
}

// ==================== AI 清洗 ====================

const CLEAN_PROMPT = `你是一个文本清洗助手。用户从网页复制了一段文本，里面可能混杂了网站导航、页头页脚、面包屑、广告、推荐链接、评论区等非正文内容。

请完成以下任务：
1. 识别并只保留小说的正文内容
2. 删除所有不属于小说正文的内容（导航、标题栏、页脚、广告、推荐、评论、版权声明等）
3. 保持原文段落结构不变
4. 不要改写、总结或翻译原文
5. 直接输出清洗后的纯文本，不要加任何解释

原始文本：
---
`;

/**
 * 调用 AI API 进行智能清洗（兼容 Anthropic / OpenAI 格式）
 * @param {string} rawText - 原始文本
 * @returns {Promise<string>} 清洗后文本
 */
function cleanWithAI(rawText) {
  return new Promise((resolve, reject) => {
    if (!AI_CONFIG.enabled) {
      reject(new Error('AI 清洗未启用，请在 utils/text-cleaner.js 中配置 AI_CONFIG'));
      return;
    }
    if (!AI_CONFIG.key) {
      reject(new Error('请填写 API Key'));
      return;
    }

    const isAnthropic = AI_CONFIG.url.includes('anthropic.com');

    let body, header;
    if (isAnthropic) {
      body = {
        model: AI_CONFIG.model,
        max_tokens: 4096,
        system: '你是一个专业的文本清洗工具。只输出清洗后的纯文本，不输出任何解释。',
        messages: [
          { role: 'user', content: CLEAN_PROMPT + rawText.slice(0, 8000) + '\n---' }
        ]
      };
      header = {
        'Content-Type': 'application/json',
        'x-api-key': AI_CONFIG.key,
        'anthropic-version': '2023-06-01'
      };
    } else {
      // OpenAI 兼容格式
      body = {
        model: AI_CONFIG.model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: '你是一个专业的文本清洗工具。只输出清洗后的纯文本，不输出任何解释。' },
          { role: 'user', content: CLEAN_PROMPT + rawText.slice(0, 8000) + '\n---' }
        ]
      };
      header = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.key}`
      };
    }

    wx.request({
      url: AI_CONFIG.url,
      method: 'POST',
      header,
      data: body,
      timeout: 30000,
      success: res => {
        if (res.statusCode === 200) {
          let cleaned;
          if (isAnthropic) {
            cleaned = (res.data.content && res.data.content[0])
              ? res.data.content[0].text
              : '';
          } else {
            cleaned = (res.data.choices && res.data.choices[0])
              ? res.data.choices[0].message.content
              : '';
          }
          resolve(cleaned.trim());
        } else {
          reject(new Error(`API 返回错误 ${res.statusCode}: ${JSON.stringify(res.data)}`));
        }
      },
      fail: err => {
        reject(new Error(`网络请求失败: ${err.errMsg}`));
      }
    });
  });
}

/**
 * 检查 AI 配置是否有效
 */
function isAIReady() {
  return AI_CONFIG.enabled && AI_CONFIG.key.length > 0;
}

module.exports = {
  cleanLocal,
  cleanWithAI,
  isAIReady,
  AI_CONFIG
};
