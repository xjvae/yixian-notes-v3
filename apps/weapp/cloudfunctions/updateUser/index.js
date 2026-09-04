const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const data = {}
    if (event.nickname) data.nickname = event.nickname
    if (event.avatar) data.avatar = event.avatar
    if (Object.keys(data).length === 0) {
      return { code: -1, message: '没有可更新的字段', data: null }
    }
    const res = await users.where({ _openid: openid }).limit(1).get()
    if (res.data.length === 0) {
      return { code: -1, message: '用户不存在', data: null }
    }
    await users.doc(res.data[0]._id).update({ data })
    return {
      code: 0,
      message: 'success',
      data: { _id: res.data[0]._id, nickname: data.nickname || res.data[0].nickname, avatar: data.avatar || res.data[0].avatar }
    }
  } catch (err) {
    console.error('[updateUser] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}