const util = require('../../utils/util.js');
const app = getApp();

Page({
  data: {
    book: null,
    characters: [],
    filterCharacter: '',
    filteredScenes: [],
    pageAnimation: {},
    hasBook: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    const animation = wx.createAnimation({ duration: 280, timingFunction: 'ease-out' });
    animation.opacity(1).translateY(0).step();
    this.setData({ pageAnimation: animation.export() });
    this.refreshBook();
  },

  /** 根据 globalData 或最新剧本刷新页面 */
  refreshBook() {
    const books = util.loadBooks();
    if (books.length === 0) {
      this.setData({ hasBook: false, book: null, characters: [], filteredScenes: [] });
      return;
    }

    let bookId = app.globalData.currentBookId;
    let book = books.find(b => b.id === bookId);

    // 回退到最新剧本
    if (!book) {
      book = books.reduce((a, b) => (a.created_at > b.created_at ? a : b));
      app.globalData.currentBookId = book.id;
    }

    const characters = (book.characters && book.characters.length)
      ? book.characters
      : [];

    this.setData({ book, characters, hasBook: true });
    this.updateFilteredScenes(this.data.filterCharacter);
  },

  /** 按角色筛选场次 */
  chooseCharacter(e) {
    const name = e.currentTarget.dataset.name || '';
    this.setData({ filterCharacter: name });
    this.updateFilteredScenes(name);
  },

  updateFilteredScenes(name) {
    const book = this.data.book;
    if (!book || !book.scenes) {
      this.setData({ filteredScenes: [] });
      return;
    }
    const scenes = book.scenes || [];
    this.setData({
      filteredScenes: name
        ? scenes.filter(item => item.character === name)
        : scenes
    });
  },

  /** 点击场次 → 跳转编辑 tab */
  gotoEditor(e) {
    const sceneId = e.currentTarget.dataset.id;
    if (!sceneId && sceneId !== 0) return;
    app.globalData.currentSceneId = sceneId;
    wx.switchTab({ url: '/pages/editor/editor' });
  },

  /** 下载全本 YAML */
  downloadAll() {
    if (!this.data.book) return;
    const content = this.data.book.scenes.map(item => item.yaml).join('\n\n---\n\n');
    util.downloadTextFile(`${this.data.book.title || '剧本'}.yaml`, content);
  }
});
