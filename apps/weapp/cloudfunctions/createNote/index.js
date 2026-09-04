const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notes = db.collection('notes')
const notebooks = db.collection('notebooks')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const title = (event.title || '').trim() || '未命名笔记'
    const content = String(event.content || '')

    // 如果指定了笔记本 id，则读取其名称
    let notebookId = event.notebookId || ''
    let notebookName = ''
    if (notebookId) {
      try {
        const nbRes = await notebooks.doc(notebookId).get()
        notebookName = nbRes.data.name || ''
      } catch (e) {
        notebookId = ''
      }
    }
    if (!notebookId) {
      const first = await notebooks.where({ _openid: openid }).orderBy('updateTime', 'desc').limit(1).get()
      if (first.data.length > 0) {
        notebookId = first.data[0]._id
        notebookName = first.data[0].name
      } else {
        const nb = await notebooks.add({ data: { _openid: openid, name: '默认笔记本', createTime: db.serverDate(), updateTime: db.serverDate() } })
        notebookId = nb._id
        notebookName = '默认笔记本'
      }
    }

    const summary = content.slice(0, 80)
    const res = await notes.add({
      data: {
        _openid: openid,
        title,
        content,
        summary,
        notebookId,
        notebookName,
        pinned: false,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    return {
      code: 0,
      message: 'success',
      data: { id: res._id, title, summary, notebookId, notebookName, createTime: Date.now(), updateTime: Date.now() }
    }
  } catch (err) {
    console.error('[createNote] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}