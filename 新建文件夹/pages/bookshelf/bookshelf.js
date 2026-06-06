const util = require('../../utils/util.js');
const app = getApp();
const COVERS = ['#c5ddff', '#d4f0ff', '#d6e4fc', '#e1f3ff', '#c8d9f8', '#dce8fc'];

Page({
  data: {
    books: [],
    swipeId: '',
    pageAnimation: {}
  },

  onShow() {
    // 更新自定义 tabBar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadBooks();
    const animation = wx.createAnimation({ duration: 280, timingFunction: 'ease-out' });
    animation.opacity(1).translateY(0).step();
    this.setData({ pageAnimation: animation.export() });
  },

  /** 加载书架数据 */
  loadBooks() {
    const books = util.loadBooks();
    const sorted = books.slice().sort((a, b) => b.created_at - a.created_at);
    const formatted = sorted.map((item, index) => ({
      ...item,
      color: COVERS[index % COVERS.length],
      createdLabel: new Date(item.created_at).toLocaleString()
    }));
    this.setData({ books: formatted });
  },

  /** 点击卡片 → 跳转剧本 tab */
  gotoBook(e) {
    const bookId = e.currentTarget.dataset.id;
    if (!bookId) return;
    app.globalData.currentBookId = bookId;
    wx.switchTab({ url: '/pages/book/book' });
  },

  /* ===== 左滑删除手势 ===== */
  onTouchStart(e) {
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  },

  onTouchMove(e) {
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const cardId = e.currentTarget.dataset.id;
    if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 60) {
      this.setData({ swipeId: deltaX < -40 ? cardId : '' });
    }
  },

  /** 确认删除 */
  deleteBook(e) {
    const bookId = e.currentTarget.dataset.id;
    if (!bookId) return;
    wx.showModal({
      title: '删除确认',
      content: '确认删除该剧本吗？',
      success: res => {
        if (res.confirm) {
          const books = util.loadBooks().filter(item => item.id !== bookId);
          util.saveBooks(books);
          this.setData({ swipeId: '' });
          this.loadBooks();
        }
      }
    });
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.loadBooks();
    wx.stopPullDownRefresh();
  }
});
