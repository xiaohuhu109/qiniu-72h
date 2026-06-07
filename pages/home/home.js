const aiAnalyzer = require('../../utils/ai-analyzer.js');
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
    textInput: '',
    hasInput: false,
    mode: 'full',
    aiReady: false,
    loading: false,
    fileName: '',
    recentScripts: mockScripts.slice(0, 2)
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.setData({ aiReady: aiAnalyzer.isReady() });
  },

  // 使用局部变量存储输入内容，避免频繁 setData 导致光标跳转
  _tempInput: '',
  _inputTimer: null,
  
  onTextInput(e) {
    const value = e.detail.value;
    this._tempInput = value;
    
    // 清除之前的定时器
    if (this._inputTimer) {
      clearTimeout(this._inputTimer);
    }
    
    // 延迟更新按钮状态，不更新 textInput（避免光标跳转）
    this._inputTimer = setTimeout(() => {
      this.setData({ 
        hasInput: value.trim().length > 0 
      });
    }, 100);
  },
  
  onTextBlur(e) {
    // 失焦时才保存到 data
    const value = e.detail.value;
    this._tempInput = value;
    this.setData({ 
      textInput: value,
      hasInput: value.trim().length > 0 
    });
  },

  /* ========== 上传 TXT ========== */
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
          wx.showToast({ title: '未获取到文件', icon: 'none' });
          return;
        }
        const filePath = file.path || file.tempFilePath;
        wx.getFileSystemManager().readFile({
          filePath,
          encoding: 'utf8',
          success: fileRes => {
            wx.hideLoading();
            const data = (fileRes.data || '').trim();
            if (!data) {
              wx.showToast({ title: '文件内容为空', icon: 'none' });
              return;
            }
            // 保存到临时变量和 data，同时更新按钮状态
            this._tempInput = data;
            this.setData({ 
              textInput: data, 
              fileName: file.name,
              hasInput: true 
            });
            wx.showToast({ title: '加载成功', icon: 'success' });
          },
          fail: err => {
            wx.hideLoading();
            wx.showToast({ title: '读取失败', icon: 'none' });
          }
        });
      },
      fail: err => {
        if (err.errMsg && err.errMsg.indexOf('cancel') > -1) return;
        wx.showToast({ title: '请选择 .txt 文件', icon: 'none' });
      }
    });
  },

  /* ========== 生成剧本 ========== */
  handleGenerate() {
    // 使用临时变量获取文本
    const text = (this._tempInput || this.data.textInput).trim();
    if (!text) {
      wx.showToast({ title: '请先输入小说文本', icon: 'none' });
      return;
    }

    // 检查 AI 是否配置
    if (!aiAnalyzer.isReady()) {
      wx.showModal({
        title: 'AI 未配置',
        content: '请先在 utils/ai-analyzer.js 中配置 DeepSeek API Key',
        showCancel: false
      });
      return;
    }

    this.setData({ loading: true, textInput: text });

    // 调用 AI 分析
    aiAnalyzer.analyzeNovel(text)
      .then(aiResult => {
        console.log('[AI] 分析完成:', aiResult);
        
        // 转换为剧本格式
        const book = aiAnalyzer.convertToBook(aiResult, this.data.mode, text);
        
        // 保存到全局数据，让 book 页面可以访问
        app.globalData.currentBook = book;
        
        this.setData({ loading: false });
        
        // 跳转到剧本详情页
        wx.navigateTo({ 
          url: `/pages/book/book?id=${book.id}&from=ai`
        });
      })
      .catch(err => {
        console.error('[AI] 分析失败:', err);
        this.setData({ loading: false });
        wx.showModal({
          title: 'AI 分析失败',
          content: err.message || '请检查网络连接和 API Key 配置',
          showCancel: false
        });
      });
  },

  /* ========== 页面跳转 ========== */
  goToBookshelf() {
    wx.switchTab({ url: '/pages/bookshelf/bookshelf' });
  },

  goToScriptDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/book/book?id=${id}` });
  }
});
