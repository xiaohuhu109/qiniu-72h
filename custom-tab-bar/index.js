Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '首页', icon: '🏠' },
      { pagePath: '/pages/bookshelf/bookshelf', text: '书架', icon: '📚' },
      { pagePath: '/pages/help/help', text: '说明', icon: 'ℹ️' }
    ]
  },

  attached() {
    this.updateSelected();
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      if (!pages || pages.length === 0) return;
      const route = '/' + pages[pages.length - 1].route;
      const index = this.data.list.findIndex(item => item.pagePath === route);
      if (index !== -1) {
        this.setData({ selected: index });
      }
    },

    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      if (index === this.data.selected) return;
      const path = this.data.list[index].pagePath;
      wx.switchTab({ url: path });
    }
  }
});
