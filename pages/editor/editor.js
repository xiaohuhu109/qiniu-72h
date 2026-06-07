const app = getApp();

// 示例数据 - 来自墨刀原型
const mockScripts = [
  {
    id: "1",
    title: "长安十二时辰 · 剧本改编",
    originalNovel: "长安十二时辰",
    scenesCount: 24,
    charactersCount: 12,
    lastEdited: "2024-06-05",
    coverColor: "#8b4513",
    scenes: [
      {
        id: "s1",
        scene_id: 1,
        title: "破晓 · 长安街头",
        setting: "日 · 外 · 长安朱雀大街",
        preview: "张小敬站在街头，看着渐渐苏醒的长安...",
        yaml: `scene_info:
  location: 长安朱雀大街
  env_type: 外景
  time: 日
description: 张小敬站在街头，看着渐渐苏醒的长安。阳光穿透晨雾，洒在青石板路上。
characters:
  - 张小敬
  - 李必
dialogues:
  - character: 张小敬
    action: 站在街头，眺望远方
    line: 这长安，终究还是醒了。
  - character: 李必
    action: 画外音
    line: 醒了，才有机会。`
      },
      {
        id: "s2",
        scene_id: 2,
        title: "密谋 · 靖安司",
        setting: "日 · 内 · 靖安司大殿",
        preview: "沙盘周围围满了人，空气中弥漫着紧张的气氛...",
        yaml: `scene_info:
  location: 靖安司大殿
  env_type: 内景
  time: 日
description: 沙盘周围围满了人，空气中弥漫着紧张的气氛。李必紧盯着沙盘上的标记。
characters:
  - 李必
  - 徐宾
dialogues:
  - character: 李必
    action: 紧盯着沙盘
    line: 如果他们在这里动手，我们只有半个时辰。
  - character: 徐宾
    action: 忧心忡忡
    line: 大人，时间不够。`
      }
    ]
  },
  {
    id: "2",
    title: "大明宫词 · 幻影",
    originalNovel: "大明宫词",
    scenesCount: 18,
    charactersCount: 8,
    lastEdited: "2024-06-04",
    coverColor: "#b22222",
    scenes: [
      {
        id: "s3",
        scene_id: 3,
        title: "宫闱密谋",
        setting: "日 · 内 · 大明宫含元殿",
        preview: "武则天端坐于龙椅之上，手中把玩着一枚玉玺...",
        yaml: `scene_info:
  location: 大明宫含元殿
  env_type: 内景
  time: 日
description: 武则天端坐于龙椅之上，手中把玩着一枚玉玺。
characters:
  - 武则天
  - 上官婉儿
dialogues:
  - character: 武则天
    action: 端坐龙椅，把玩玉玺
    line: 你说，这天下，究竟是李家的天下，还是武家的天下？
  - character: 上官婉儿
    action: 低头
    line: 回陛下，自然是——陛下的天下。`
      }
    ]
  }
];

Page({
  data: {
    script: null,
    scene: null,
    yamlText: '',
    hasScene: false,
    originalText: '',  // 小说原文
    showOriginal: false,  // 是否显示原文弹窗
    showExport: false  // 是否显示导出选项
  },

  onLoad(options) {
    const sceneId = options.sceneId;

    // 1. 先尝试从 globalData 获取（AI 生成的剧本）
    if (app.globalData.currentBook && sceneId.startsWith('scene_')) {
      const book = app.globalData.currentBook;
      const sceneIndex = parseInt(sceneId.replace('scene_', '')) - 1;
      const aiScene = book.scenes[sceneIndex];

      if (aiScene) {
        console.log('[editor] book:', book);
        console.log('[editor] originalText:', book.originalText);
        console.log('[editor] originalText length:', book.originalText ? book.originalText.length : 0);

        this.setData({
          script: {
            id: 'ai_script',
            title: book.title + ' · 剧本改编',
            originalNovel: book.title
          },
          scene: {
            id: sceneId,
            title: aiScene.title || `场景 ${aiScene.scene_id}`,
            setting: `${aiScene.time} · ${aiScene.env_type} · ${aiScene.location}`,
            preview: aiScene.action || ''
          },
          yamlText: aiScene.yaml,
          originalText: book.originalText || '',  // 保存原文
          hasScene: true
        });
        return;
      }
    }

    // 2. 尝试从示例数据查找
    for (const script of mockScripts) {
      const scene = script.scenes.find(s => s.id === sceneId);
      if (scene) {
        this.setData({
          script: script,
          scene: scene,
          yamlText: scene.yaml,
          hasScene: true
        });
        return;
      }
    }

    // 3. 尝试从本地存储加载（从书架打开的剧本）
    try {
      const bookshelf = wx.getStorageSync('bookshelf') || [];
      for (const script of bookshelf) {
        if (script.aiData && script.aiData.scenes) {
          const sceneIndex = parseInt(sceneId.replace('scene_', '')) - 1;
          const aiScene = script.aiData.scenes[sceneIndex];
          if (aiScene) {
            this.setData({
              script: {
                id: script.id,
                title: script.title,
                originalNovel: script.originalNovel
              },
              scene: {
                id: sceneId,
                title: aiScene.title || `场景 ${aiScene.scene_id}`,
                setting: `${aiScene.time} · ${aiScene.env_type} · ${aiScene.location}`,
                preview: aiScene.action || ''
              },
              yamlText: aiScene.yaml,
              originalText: script.aiData.originalText || '',  // 从 aiData 获取原文
              hasScene: true
            });
            return;
          }
        }
      }
    } catch (e) {
      console.error('[editor] 从本地存储加载失败:', e);
    }

    // 4. 都没找到
    this.setData({ hasScene: false });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  onInput(e) {
    this.setData({ yamlText: e.detail.value });
  },

  /** 保存修改 */
  saveScene() {
    const yamlText = this.data.yamlText.trim();
    if (!yamlText) {
      return wx.showToast({ title: '剧本内容不能为空', icon: 'none' });
    }

    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  /** 显示导出选项 */
  showExportOptions() {
    this.setData({ showExport: true });
  },

  /** 隐藏导出选项 */
  hideExportOptions() {
    this.setData({ showExport: false });
  },

  /** 复制到剪贴板 */
  copyToClipboard() {
    const content = this.data.yamlText;
    wx.setClipboardData({
      data: content,
      success: () => {
        this.hideExportOptions();
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  /** 下载 TXT 文件 */
  downloadTxtFile() {
    const content = this.data.yamlText;
    const fileName = `${this.data.scene.title || '剧本'}.txt`;
    
    // 将内容写入临时文件
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      
      // 使用 shareFileMessage 直接分享文件
      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: () => {
          this.hideExportOptions();
          wx.showToast({ title: '请选择发送方式', icon: 'success' });
        },
        fail: (err) => {
          console.error('分享文件失败:', err);
          wx.showToast({ title: '导出失败，请重试', icon: 'none' });
        }
      });
    } catch (err) {
      console.error('写入文件失败:', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },

  /** 显示原文 */
  showOriginalText() {
    this.setData({ showOriginal: true });
  },

  /** 隐藏原文 */
  hideOriginalText() {
    this.setData({ showOriginal: false });
  },

  /** 阻止事件冒泡 */
  preventHide() {
    // 什么都不做，只是阻止事件冒泡
  }
});
