const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notes = db.collection('notes')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const id = event.id
    if (!id) {
      return { code: -1, message: '参数错误', data: null }
    }
    const res = await notes.doc(id).get()
    const n = res.data
    if (!n || n._openid !== openid) {
      return { code: -1, message: '笔记不存在', data: null }
    }
    return {
      code: 0,
      message: 'success',
      data: {
        id: n._id,
        title: n.title,
        content: n.content || '',
        summary: n.summary || '',
        notebookId: n.notebookId || '',
        notebookName: n.notebookName || '',
        createTime: (n.createTime && n.createTime.getTime()) || Date.now(),
        updateTime: (n.updateTime && n.updateTime.getTime()) || Date.now()
      }
    }
  } catch (err) {
    console.error('[getNoteDetail] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}