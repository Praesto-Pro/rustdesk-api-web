import { httpUrl } from '@/utils/safe-url'
import { ElMessageBox } from 'element-plus'
import { T } from '@/utils/i18n'
import { useAppStore } from '@/store/app'



const app = useAppStore()

export const toWebClientLink = (row) => {
  //v2
  const url = httpUrl(`${app.setting.rustdeskConfig.api_server}/webclient2/`)
  url.hash = `/${encodeURIComponent(String(row.id))}`
  window.open(url.href, '_blank', 'noopener,noreferrer')
}

export async function getPeerSlat (id) {
  const [{ default: Websock }, rendezvous, message] = await Promise.all([
    import('@/utils/webclient/websock'),
    import('@/utils/webclient/rendezvous'),
    import('@/utils/webclient/message'),
  ])
  const [addr, port] = app.setting.rustdeskConfig.id_server.split(':')
  if (!addr) {
    return
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new Websock(`${scheme}://${addr}:21118`, true)
  await ws.open()
  const conn_type = rendezvous.ConnType.DEFAULT_CONN
  const nat_type = rendezvous.NatType.SYMMETRIC
  const punch_hole_request = rendezvous.PunchHoleRequest.fromPartial({
    id,
    licence_key: app.setting.rustdeskConfig.value.key || undefined,
    conn_type,
    nat_type,
    token: undefined,
  })
  ws.sendRendezvous({ punch_hole_request })
  //rendezvous.RendezvousMessage
  const msg = (await ws.next())
  ws.close()
  console.log(new Date() + ': Got relay response', msg)
  const phr = msg.punch_hole_response
  const rr = msg.relay_response
  if (phr) {
    if (phr?.other_failure) {
      this.msgbox('error', 'Error', phr?.other_failure)
      return
    }
    if (phr.failure != rendezvous.PunchHoleResponse_Failure.UNRECOGNIZED) {
      switch (phr?.failure) {
        case rendezvous.PunchHoleResponse_Failure.ID_NOT_EXIST:
          ElMessageBox.alert(T('IDNotExist'), T('Error'))
          break
        case rendezvous.PunchHoleResponse_Failure.OFFLINE:
          ElMessageBox.alert(T('RemoteDesktopOffline'), T('Error'))
          break
        case rendezvous.PunchHoleResponse_Failure.LICENSE_MISMATCH:
          ElMessageBox.alert(T('KeyMismatch'), T('Error'))
          break
        case rendezvous.PunchHoleResponse_Failure.LICENSE_OVERUSE:
          ElMessageBox.alert(T('KeyOveruse'), T('Error'))
          break
      }
    }
    return false
  } else if (rr) {
    const uuid = rr.uuid
    console.log(new Date() + ': Connecting to relay server')

    const _ws = new Websock(`${scheme}://${addr}:21119`, false)
    await _ws.open()
    console.log(new Date() + ': Connected to relay server')
    const request_relay = rendezvous.RequestRelay.fromPartial({
      licence_key: app.setting.rustdeskConfig.key || undefined,
      uuid,
    })
    _ws.sendRendezvous({ request_relay })

    //暂不支持pk
    const public_key = message.PublicKey.fromPartial({})
    _ws?.sendMessage({ public_key })
    // const secure = (await this.secure(pk)) || false;
    // globals.pushEvent("connection_ready", { secure, direct: false });
    while (true) {
      const msg = (await _ws?.next())
      console.log('msg', msg)
      if (msg?.hash) {
        console.log('hash msg.....', msg.hash)
        _ws.close()
        return msg.hash
      }
    }
    return false
  }

}

export function getV2ShareUrl (token) {
  const url = httpUrl(`${app.setting.rustdeskConfig.api_server}/webclient2/`)
  url.hash = `/?share_token=${encodeURIComponent(String(token))}`
  return url.href
}
