const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const todos = db.collection('todos')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const where = { _openid: openid }
    if (event.status === 'done') where.completed = true
    else if (event.status === 'active') where.completed = false

    const res = await todos.where(where).orderBy('createTime', 'desc').limit(100).get()
    const list = res.data.map((t) => ({
      id: t._id,
      title: t.title,
      completed: !!t.completed,
      dueText: t.dueText || '',
      createTime: (t.createTime && t.createTime.getTime()) || Date.now()
    }))
    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[getTodos] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}