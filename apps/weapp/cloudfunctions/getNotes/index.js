const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notes = db.collection('notes')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const pageNo = event.pageNo || 1
    const pageSize = Math.min(event.pageSize || 10, 50)

    const where = { _openid: openid }
    if (event.notebookId) where.notebookId = event.notebookId
    if (event.keyword) {
      const reg = db.RegExp({ regexp: event.keyword, options: 'i' })
      where.title = reg
    }

    const countRes = await notes.where(where).count()
    const total = countRes.total
    const listRes = await notes
      .where(where)
      .orderBy('updateTime', 'desc')
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize)
      .get()

    const list = listRes.data.map((n) => ({
      id: n._id,
      title: n.title,
      summary: n.summary || '',
      notebookId: n.notebookId || '',
      notebookName: n.notebookName || '',
      createTime: (n.createTime && n.createTime.getTime()) || Date.now(),
      updateTime: (n.updateTime && n.updateTime.getTime()) || Date.now(),
      pinned: !!n.pinned
    }))

    return { code: 0, message: 'success', data: { list, pageNo, pageSize, total, hasMore: pageNo * pageSize < total } }
  } catch (err) {
    console.error('[getNotes] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}