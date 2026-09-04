const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notes = db.collection('notes')
const notebooks = db.collection('notebooks')
const todos = db.collection('todos')
const reminders = db.collection('reminders')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const [noteCount, notebookCount, todoCount, reminderCount] = await Promise.all([
      notes.where({ _openid: openid }).count(),
      notebooks.where({ _openid: openid }).count(),
      todos.where({ _openid: openid }).count(),
      reminders.where({ _openid: openid }).count()
    ])
    return {
      code: 0,
      message: 'success',
      data: {
        noteCount: noteCount.total,
        notebookCount: notebookCount.total,
        todoCount: todoCount.total,
        reminderCount: reminderCount.total
      }
    }
  } catch (err) {
    console.error('[getStats] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}