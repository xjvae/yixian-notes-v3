const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const todos = db.collection('todos')

exports.main = async (event, context) => {
  try {
    const id = event.id
    const completed = !!event.completed
    if (!id) {
      return { code: -1, message: '参数错误', data: null }
    }
    await todos.doc(id).update({ data: { completed } })
    return { code: 0, message: 'success', data: { id, completed } }
  } catch (err) {
    console.error('[toggleTodo] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}