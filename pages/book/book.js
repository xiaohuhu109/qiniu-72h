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
        characters: ["张小敬", "李必"],
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
        characters: ["李必", "徐宾"],
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
        characters: ["武则天", "上官婉儿"],
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
  },
  {
    id: "3",
    title: "琅琊榜 · 梅岭雪",
    originalNovel: "琅琊榜",
    scenesCount: 32,
    charactersCount: 15,
    lastEdited: "2024-06-02",
    coverColor: "#2f4f4f",
    scenes: []
  },
  {
    id: "4",
    title: "红楼梦 · 葬花",
    originalNovel: "红楼梦",
    scenesCount: 12,
    charactersCount: 20,
    lastEdited: "2024-05-30",
    coverColor: "#db7093",
    scenes: []
  }
];

Page({
  data: {
    script: null,
    isAIGenerated: false,
    isSaved: false,
    // 筛选相关
    allLocations: [],
    allCharacters: [],
    filterLocation: '',
    filterCharacter: '',
    filteredScenes: []
  },

  onLoad(options) {
    // 检查是否是从 AI 生成跳转过来的
    if (options.from === 'ai' && app.globalData.currentBook) {
      this._loadFromAIGeneration();
    } else if (options.id) {
      // 从书架或其他页面打开，尝试从本地存储加载
      this._loadFromStorage(options.id);
    } else {
      // 默认显示示例数据
      this.setData({ script: mockScripts[0], isAIGenerated: false, isSaved: true });
      this._initFilterData(mockScripts[0]);
    }
  },

  // 从 AI 生成加载
  _loadFromAIGeneration() {
    const book = app.globalData.currentBook;

    // 转换 AI 生成的数据为页面需要的格式
    const scenes = book.scenes.map((s, index) => ({
      id: `scene_${s.scene_id}`,
      sceneIndex: index + 1,
      title: s.title || `场景 ${s.scene_id}`,
      setting: `${s.time} · ${s.env_type} · ${s.location}`,
      preview: s.action || '场景描述...',
      characters: s.characters || [s.character].filter(Boolean),
      content: s.yaml
    }));

    // 生成唯一 ID，避免重复
    const uniqueId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const script = {
      id: uniqueId,
      title: book.title + ' · 剧本改编',
      originalNovel: book.title,
      scenesCount: scenes.length,
      charactersCount: book.characters ? book.characters.length : 0,
      lastEdited: new Date().toISOString().split('T')[0],
      coverColor: this._getRandomColor(),
      scenes: scenes,
      originalText: book.originalText,  // 保存原文
      // 保存完整的 AI 数据以便后续编辑
      aiData: book
    };

    this.setData({
      script: script,
      isAIGenerated: true,
      isSaved: false
    });

    this._initFilterData(script);
  },

  // 从本地存储加载
  _loadFromStorage(scriptId) {
    try {
      const bookshelf = wx.getStorageSync('bookshelf') || [];
      const savedScript = bookshelf.find(s => s.id === scriptId);

      if (savedScript) {
        // 恢复 aiData 到 globalData，以便编辑器使用
        if (savedScript.aiData) {
          app.globalData.currentBook = savedScript.aiData;
        }

        this.setData({
          script: savedScript,
          isAIGenerated: true,
          isSaved: true
        });

        this._initFilterData(savedScript);
      } else {
        // 如果没有找到，尝试从示例数据查找
        const mockScript = mockScripts.find(s => s.id === scriptId);
        if (mockScript) {
          this.setData({ script: mockScript, isAIGenerated: false, isSaved: true });
          this._initFilterData(mockScript);
        } else {
          this.setData({ script: mockScripts[0], isAIGenerated: false, isSaved: true });
          this._initFilterData(mockScripts[0]);
        }
      }
    } catch (e) {
      console.error('加载失败:', e);
      const mockScript = mockScripts.find(s => s.id === scriptId) || mockScripts[0];
      this.setData({ script: mockScript, isAIGenerated: false, isSaved: true });
      this._initFilterData(mockScript);
    }
  },

  // 初始化筛选数据
  _initFilterData(script) {
    if (!script || !script.scenes) return;

    // 提取所有地点
    const locationSet = new Set();
    // 提取所有人物
    const characterSet = new Set();

    script.scenes.forEach(scene => {
      // 从 setting 中提取地点（格式：时间 · 内外景 · 地点）
      if (scene.setting) {
        const parts = scene.setting.split('·');
        if (parts.length >= 3) {
          locationSet.add(parts[2].trim());
        }
      }

      // 提取人物
      if (scene.characters && Array.isArray(scene.characters)) {
        scene.characters.forEach(char => {
          if (char && char !== '未知') {
            characterSet.add(char);
          }
        });
      }
    });

    this.setData({
      allLocations: Array.from(locationSet),
      allCharacters: Array.from(characterSet),
      filteredScenes: script.scenes
    });
  },

  // 按地点筛选
  filterByLocation(e) {
    const location = e.currentTarget.dataset.location;
    const currentFilter = this.data.filterLocation === location ? '' : location;

    this.setData({ filterLocation: currentFilter });
    this._applyFilter();
  },

  // 按人物筛选
  filterByCharacter(e) {
    const character = e.currentTarget.dataset.character;
    const currentFilter = this.data.filterCharacter === character ? '' : character;

    this.setData({ filterCharacter: currentFilter });
    this._applyFilter();
  },

  // 清除筛选
  clearFilter() {
    this.setData({
      filterLocation: '',
      filterCharacter: ''
    });
    this._applyFilter();
  },

  // 应用筛选
  _applyFilter() {
    const { script, filterLocation, filterCharacter } = this.data;
    if (!script || !script.scenes) return;

    let filtered = script.scenes;

    // 按地点筛选
    if (filterLocation) {
      filtered = filtered.filter(scene => {
        if (!scene.setting) return false;
        const parts = scene.setting.split('·');
        return parts.length >= 3 && parts[2].trim() === filterLocation;
      });
    }

    // 按人物筛选
    if (filterCharacter) {
      filtered = filtered.filter(scene => {
        if (!scene.characters || !Array.isArray(scene.characters)) return false;
        return scene.characters.includes(filterCharacter);
      });
    }

    this.setData({ filteredScenes: filtered });
  },

  // 根据标题生成固定颜色
  _getRandomColor() {
    const colors = ['#8b4513', '#b22222', '#2f4f4f', '#db7093', '#556b2f', '#483d8b'];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // 保存到书架
  saveToBookshelf() {
    const script = this.data.script;
    if (!script) return;

    try {
      let bookshelf = wx.getStorageSync('bookshelf') || [];

      // 检查是否已存在
      const existsIndex = bookshelf.findIndex(b => b.id === script.id);
      if (existsIndex >= 0) {
        // 更新已有剧本
        bookshelf[existsIndex] = script;
      } else {
        // 添加新剧本到开头
        bookshelf.unshift(script);
      }

      // 最多保存 50 本
      if (bookshelf.length > 50) {
        bookshelf = bookshelf.slice(0, 50);
      }

      wx.setStorageSync('bookshelf', bookshelf);

      this.setData({ isSaved: true });

      wx.showToast({
        title: '已保存到书架',
        icon: 'success'
      });
    } catch (e) {
      console.error('保存失败:', e);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  goToEditor(e) {
    const sceneId = e.currentTarget.dataset.id;

    console.log('[goToEditor] sceneId:', sceneId);
    console.log('[goToEditor] isAIGenerated:', this.data.isAIGenerated);
    console.log('[goToEditor] currentBook:', app.globalData.currentBook);

    if (!sceneId) {
      console.error('[goToEditor] sceneId is empty!');
      wx.showToast({ title: '场次ID为空', icon: 'none' });
      return;
    }

    // 如果是 AI 生成的，需要找到对应的场景数据
    if (this.data.isAIGenerated && app.globalData.currentBook) {
      const book = app.globalData.currentBook;
      const sceneIndex = parseInt(sceneId.replace('scene_', '')) - 1;
      const scene = book.scenes[sceneIndex];

      console.log('[goToEditor] sceneIndex:', sceneIndex, 'scene:', scene);

      if (scene) {
        app.globalData.currentScene = scene;
      }
    }

    wx.navigateTo({
      url: `/pages/editor/editor?sceneId=${sceneId}`,
      success: () => {
        console.log('[goToEditor] navigate success');
      },
      fail: (err) => {
        console.error('[goToEditor] navigate fail:', err);
        wx.showToast({ title: '跳转失败', icon: 'none' });
      }
    });
  }
});
