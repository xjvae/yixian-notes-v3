const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notebooks = db.collection('notebooks')
const notes = db.collection('notes')

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const nbRes = await notebooks.where({ _openid: openid }).orderBy('updateTime', 'desc').get()
    const list = await Promise.all(nbRes.data.map(async (nb) => {
      const countRes = await notes.where({ _openid: openid, notebookId: nb._id }).count()
      return {
        _id: nb._id,
        name: nb.name,
        cover: nb.cover || '',
        noteCount: countRes.total,
        createTime: (nb.createTime && nb.createTime.getTime()) || Date.now(),
        updateTime: (nb.updateTime && nb.updateTime.getTime()) || Date.now()
      }
    }))
    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[getNotebooks] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}