const util = require('../../utils/util.js');
const app = getApp();

Page({
  data: {
    textInput: '',
    mode: 'full',
    loading: false,
    loadingText: '',
    fileName: '',        // 已上传文件名
    pageAnimation: {}
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const animation = wx.createAnimation({ duration: 280, timingFunction: 'ease-out' });
    animation.opacity(1).translateY(0).step();
    this.setData({ pageAnimation: animation.export() });
  },

  onTextInput(e) {
    this.setData({ textInput: e.detail.value });
  },

  onModeChange(e) {
    this.setData({ mode: e.detail.value });
  },

  /** 上传 TXT 文件 */
  chooseTxt() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['txt'],
      success: res => {
        wx.showLoading({ title: '读取文件中...', mask: true });

        const file = res.tempFiles && res.tempFiles[0];
        if (!file) {
          wx.hideLoading();
          wx.showToast({ title: '未获取到文件，请重试', icon: 'none' });
          return;
        }

        const filePath = file.path || file.tempFilePath;
        console.log('[chooseTxt] 选中文件:', JSON.stringify({
          name: file.name,
          size: file.size,
          path: filePath
        }));

        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath,
          encoding: 'utf8',
          success: fileRes => {
            wx.hideLoading();
            const data = (fileRes.data || '').trim();
            if (data.length === 0) {
              wx.showToast({ title: '文件内容为空', icon: 'none' });
              return;
            }
            // 写入 textarea 并显示文件名
            this.setData({
              textInput: data,
              fileName: file.name || '已选择文件'
            });
            wx.showToast({ title: `已加载：${file.name}`, icon: 'success' });
          },
          fail: err => {
            wx.hideLoading();
            console.error('[chooseTxt] 读取失败:', JSON.stringify(err));
            wx.showToast({ title: '读取失败，请确认文件编码为 UTF-8', icon: 'none', duration: 2500 });
          }
        });
      },
      fail: err => {
        console.error('[chooseTxt] 选择文件失败:', JSON.stringify(err));
        // 用户取消选择时不弹错误
        if (err && err.errMsg && err.errMsg.indexOf('cancel') > -1) return;
        wx.showToast({ title: '请在微信聊天中选择 .txt 文件', icon: 'none', duration: 2500 });
      }
    });
  },

  /** 清空文本 */
  clearText() {
    this.setData({ textInput: '', fileName: '' });
  },

  /** 生成剧本 */
  onGenerate() {
    const text = this.data.textInput.trim();
    if (!text) {
      return wx.showToast({ title: '请先输入小说文本', icon: 'none' });
    }

    wx.showLoading({ title: '生成中...', mask: true });
    const book = util.generateBookFromText(text, this.data.mode);
    const books = util.loadBooks();
    books.unshift(book);
    util.saveBooks(books);

    app.globalData.currentBookId = book.id;
    app.globalData.currentSceneId = book.scenes[0] ? book.scenes[0].scene_id : 0;

    wx.hideLoading();
    this.startLoadingAnimation(() => {
      wx.switchTab({ url: '/pages/book/book' });
    });
  },

  /** 加载动画 */
  startLoadingAnimation(callback) {
    const steps = ['拆分场景中', '提取角色中', '生成剧本中'];
    this.setData({ loading: true, loadingText: steps[0] });
    let index = 1;
    const timer = setInterval(() => {
      if (index >= steps.length) {
        clearInterval(timer);
        this.setData({ loadingText: '生成成功，正在跳转...' });
        setTimeout(() => {
          this.setData({ loading: false, loadingText: '' });
          callback();
        }, 500);
        return;
      }
      this.setData({ loadingText: steps[index] });
      index += 1;
    }, 700);
  }
});
