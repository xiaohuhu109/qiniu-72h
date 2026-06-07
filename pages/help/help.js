Page({
  data: {
    pageAnimation: {}
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    const animation = wx.createAnimation({ duration: 280, timingFunction: 'ease-out' });
    animation.opacity(1).translateY(0).step();
    this.setData({ pageAnimation: animation.export() });
  }
});
