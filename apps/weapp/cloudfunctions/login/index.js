const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const nickname = event.nickname || '一闲用户'
    const avatar = event.avatar || ''

    const existed = await users.where({ _openid: openid }).limit(1).get()

    if (existed.data.length > 0) {
      const user = existed.data[0]
      await users.doc(user._id).update({
        data: { lastLoginAt: db.serverDate() }
      })
      return {
        code: 0,
        message: 'success',
        data: { user: { _id: user._id, nickname: user.nickname, avatar: user.avatar, createdAt: user.createdAt, lastLoginAt: Date.now() }, isNew: false }
      }
    }

    const doc = {
      nickname,
      avatar,
      createdAt: db.serverDate(),
      lastLoginAt: db.serverDate()
    }
    const res = await users.add({ data: doc })
    return {
      code: 0,
      message: 'success',
      data: {
        user: { _id: res._id, nickname, avatar, createdAt: Date.now(), lastLoginAt: Date.now() },
        isNew: true
      }
    }
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}