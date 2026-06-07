// 示例数据 - 来自墨刀原型
const mockScripts = [
  {
    id: "1",
    title: "长安十二时辰 · 剧本改编",
    originalNovel: "长安十二时辰",
    scenesCount: 24,
    charactersCount: 12,
    lastEdited: "2024-06-05",
    coverColor: "#8b4513"
  },
  {
    id: "2",
    title: "大明宫词 · 幻影",
    originalNovel: "大明宫词",
    scenesCount: 18,
    charactersCount: 8,
    lastEdited: "2024-06-04",
    coverColor: "#b22222"
  },
  {
    id: "3",
    title: "琅琊榜 · 梅岭雪",
    originalNovel: "琅琊榜",
    scenesCount: 32,
    charactersCount: 15,
    lastEdited: "2024-06-02",
    coverColor: "#2f4f4f"
  },
  {
    id: "4",
    title: "红楼梦 · 葬花",
    originalNovel: "红楼梦",
    scenesCount: 12,
    charactersCount: 20,
    lastEdited: "2024-05-30",
    coverColor: "#db7093"
  }
];

Page({
  data: {
    scripts: []
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }

    // 从本地存储加载书架数据
    this.loadBookshelf();
  },

  // 加载书架数据
  loadBookshelf() {
    try {
      const savedBooks = wx.getStorageSync('bookshelf') || [];

      if (savedBooks.length > 0) {
        // 使用保存的数据
        this.setData({ scripts: savedBooks });
      } else {
        // 如果没有保存的数据，显示示例数据
        this.setData({ scripts: mockScripts });
      }
    } catch (e) {
      console.error('加载书架失败:', e);
      this.setData({ scripts: mockScripts });
    }
  },

  goToScript(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/book/book?id=${id}` });
  },

  goToHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
