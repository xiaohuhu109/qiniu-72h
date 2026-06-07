App({
  globalData: {
    currentBookId: '',
    currentSceneId: 0
  },

  onLaunch() {
    const books = wx.getStorageSync('novel2script_books');
    if (!Array.isArray(books)) {
      wx.setStorageSync('novel2script_books', []);
    }
  }
});
