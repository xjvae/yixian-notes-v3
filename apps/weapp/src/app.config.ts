export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/library/index',
    'pages/capture/index',
    'pages/mine/index',
    'pages/note-detail/index',
    'pages/notebook-detail/index',
    'pages/todos/index',
    'pages/reminders/index',
    'pages/settings/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '一闲笔记',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f4f7f5',
    backgroundColorTop: '#e8f4ef'
  },
  tabBar: {
    custom: true,
    color: '#86909c',
    selectedColor: '#2f8a6f',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.svg',
        selectedIconPath: 'assets/tabbar/home-selected.svg'
      },
      {
        pagePath: 'pages/library/index',
        text: '知识库',
        iconPath: 'assets/tabbar/library.svg',
        selectedIconPath: 'assets/tabbar/library-selected.svg'
      },
      {
        pagePath: 'pages/capture/index',
        text: '速记',
        iconPath: 'assets/tabbar/capture.svg',
        selectedIconPath: 'assets/tabbar/capture-selected.svg'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.svg',
        selectedIconPath: 'assets/tabbar/mine-selected.svg'
      }
    ]
  }
})