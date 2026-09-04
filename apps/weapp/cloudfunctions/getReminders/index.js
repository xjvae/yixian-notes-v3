const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const reminders = db.collection('reminders')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const res = await reminders.where({ _openid: openid }).orderBy('remindAt', 'asc').limit(100).get()
    const list = res.data.map((r) => ({
      id: r._id,
      title: r.title,
      remindAt: (r.remindAt && r.remindAt.getTime()) || Date.now(),
      done: !!r.done,
      note: r.note || ''
    }))
    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[getReminders] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}