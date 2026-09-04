const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notebooks = db.collection('notebooks')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const name = (event.name || '').trim()
    if (!name) {
      return { code: -1, message: '笔记本名称不能为空', data: null }
    }
    const res = await notebooks.add({
      data: { _openid: openid, name, cover: event.cover || '', createTime: db.serverDate(), updateTime: db.serverDate() }
    })
    return {
      code: 0,
      message: 'success',
      data: { _id: res._id, name, cover: event.cover || '', noteCount: 0, createTime: Date.now(), updateTime: Date.now() }
    }
  } catch (err) {
    console.error('[createNotebook] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}