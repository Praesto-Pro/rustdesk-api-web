import en from '@/utils/i18n/en.json'
import fr from '@/utils/i18n/fr.json'
import zhCN from '@/utils/i18n/zh_CN.json'
import ko from '@/utils/i18n/ko.json'
import ru from '@/utils/i18n/ru.json'
import es from '@/utils/i18n/es.json'
import zhTW from '@/utils/i18n/zh_TW.json'
import { useAppStore } from '@/store/app'

const trans = {
  'en': en,
  'fr': fr,
  'zh-CN': zhCN,
  'ko': ko,
  'ru': ru,
  'es': es,
  'zh-TW': zhTW,
}
// Reuse the existing locale vocabulary for the new contextual English labels.
const existingTranslationKeys = {
  "My devices": "MyPeer",
  "My connections": "AddressBooks",
  "My address books": "AddressBookName",
  "My tags": "Tags",
  "My shared links": "ShareRecord",
  "All devices": "PeerManage",
  "Device groups": "DeviceGroupManage",
  "All connections": "AddressBookManage",
  "All address books": "AddressBookNameManage",
  "All tags": "TagsManage",
  "Connection history": "AuditConnLog",
  "File transfers": "AuditFileLog",
  "Sign-in history": "LoginLog",
  "Shared links": "ShareRecord",
  "My sign-ins": "LoginLog",
  "Users": "UserManage",
  "User groups": "GroupManage",
  "Sign-in providers": "OauthManage",
  "Access tokens": "UserToken",
  "Server settings": "ServerCmd",
  "My account": "Userinfo",
  "Sign in": "Login",
  "Create account": "Register",
  "Create an account": "Register",
  "Connect": "Link",
  "View": "Info"
}

export function T (key, params = {}, num = 0) {
  const appStore = useAppStore()
  const lang = appStore.setting.lang
  const tran = trans[lang]?.[key] || (lang !== 'en' && trans[lang]?.[existingTranslationKeys[key]]) || en[key]
  if (!tran) {
    return key
  }
  const msg = num > 1 ? (tran.Other ? tran.Other : tran.One) : tran.One
  //msg 是这样 {name} is name
  //params 是这样 {name: 'zhangsan'}
  //替换
  return msg.replace(/{(\w+)}/g, function (match, key) {
    return params[key] ?? match
  })
}
