const util = require('../../utils/util.js');
const app = getApp();

Page({
  data: {
    bookId: '',
    sceneId: 0,
    book: null,
    scene: null,
    yamlText: '',
    validationMessage: '请编辑剧本后保存或校验',
    validationError: false,
    pageAnimation: {},
    hasScene: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    const animation = wx.createAnimation({ duration: 280, timingFunction: 'ease-out' });
    animation.opacity(1).translateY(0).step();
    this.setData({ pageAnimation: animation.export() });
    this.refreshScene();
  },

  /** 根据 globalData 刷新当前编辑的场次 */
  refreshScene() {
    const books = util.loadBooks();
    const bookId = app.globalData.currentBookId;
    const sceneId = app.globalData.currentSceneId;

    const book = books.find(b => b.id === bookId);
    if (!book) {
      // 回退到任意有场次的剧本
      const fallback = books.find(b => b.scenes && b.scenes.length > 0);
      if (fallback) {
        app.globalData.currentBookId = fallback.id;
        app.globalData.currentSceneId = fallback.scenes[0].scene_id;
        this.loadSceneData(fallback.id, fallback.scenes[0].scene_id);
        return;
      }
      this.setData({ hasScene: false });
      return;
    }

    const scene = book.scenes.find(s => s.scene_id === sceneId);
    if (!scene && book.scenes.length > 0) {
      app.globalData.currentSceneId = book.scenes[0].scene_id;
      this.loadSceneData(book.id, book.scenes[0].scene_id);
      return;
    }
    if (!scene) {
      this.setData({ hasScene: false });
      return;
    }

    this.loadSceneData(book.id, scene.scene_id);
  },

  /** 加载指定场次数据 */
  loadSceneData(bookId, sceneId) {
    const books = util.loadBooks();
    const book = books.find(item => item.id === bookId);
    if (!book) { this.setData({ hasScene: false }); return; }
    const scene = book.scenes.find(item => item.scene_id === sceneId);
    if (!scene) { this.setData({ hasScene: false }); return; }

    this.setData({
      hasScene: true,
      bookId,
      sceneId,
      book,
      scene,
      yamlText: scene.yaml || '',
      validationMessage: '请编辑剧本后保存或校验',
      validationError: false
    });
  },

  onInput(e) {
    this.setData({ yamlText: e.detail.value });
  },

  /** 保存修改 */
  saveScene() {
    const yamlText = this.data.yamlText.trim();
    if (!yamlText) {
      return wx.showToast({ title: 'YAML 内容不能为空', icon: 'none' });
    }

    const books = util.loadBooks();
    const bookIndex = books.findIndex(item => item.id === this.data.bookId);
    if (bookIndex === -1) return wx.showToast({ title: '未找到剧本', icon: 'none' });

    const sceneIndex = books[bookIndex].scenes.findIndex(
      item => item.scene_id === this.data.sceneId
    );
    if (sceneIndex === -1) return wx.showToast({ title: '未找到场次', icon: 'none' });

    books[bookIndex].scenes[sceneIndex].yaml = yamlText;

    // 同步更新角色字段
    const charMatch = yamlText.match(/^character:\s*(.+)$/m);
    if (charMatch) {
      books[bookIndex].scenes[sceneIndex].character = charMatch[1].trim();
    }

    util.saveBooks(books);
    this.setData({ validationMessage: '✓ 保存成功', validationError: false });
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  /** 校验 YAML */
  validateScene() {
    const text = this.data.yamlText;
    const required = ['script_id', 'scene_info', 'character', 'dialogue'];
    const missing = required.filter(f => !new RegExp(`${f}:`, 'm').test(text));

    if (missing.length > 0) {
      this.setData({
        validationMessage: `⚠ 缺少字段：${missing.join('、')}`,
        validationError: true
      });
      return;
    }

    const character = util.parseYamlCharacter(text);
    if (!character) {
      this.setData({
        validationMessage: '⚠ 未检测到 character 字段',
        validationError: true
      });
      return;
    }

    this.setData({
      validationMessage: '✓ 校验通过，格式正确',
      validationError: false
    });
  },

  /** 导出单场 YAML */
  downloadScene() {
    if (!this.data.scene) return;
    util.downloadTextFile(
      `${this.data.book.title || '剧本'}_场次${this.data.scene.scene_id}.yaml`,
      this.data.yamlText
    );
  },

  /** 上一场 */
  prevScene() {
    if (!this.data.book) return;
    const scenes = this.data.book.scenes;
    const idx = scenes.findIndex(s => s.scene_id === this.data.sceneId);
    if (idx > 0) {
      app.globalData.currentSceneId = scenes[idx - 1].scene_id;
      this.loadSceneData(this.data.bookId, scenes[idx - 1].scene_id);
    }
  },

  /** 下一场 */
  nextScene() {
    if (!this.data.book) return;
    const scenes = this.data.book.scenes;
    const idx = scenes.findIndex(s => s.scene_id === this.data.sceneId);
    if (idx < scenes.length - 1) {
      app.globalData.currentSceneId = scenes[idx + 1].scene_id;
      this.loadSceneData(this.data.bookId, scenes[idx + 1].scene_id);
    }
  }
});
