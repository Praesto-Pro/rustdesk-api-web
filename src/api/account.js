import request from '@/utils/request'

export const accountOptions = () => request({ url: '/account/options' })
export const getServerSettings = () => request({ url: '/settings' })
export const saveServerSettings = data => request({ url: '/settings', method: 'post', data })
export const testMail = email => request({ url: '/settings/test-mail', method: 'post', data: { email } })
export const inviteUser = data => request({ url: '/settings/invite', method: 'post', data })
export const requestPasswordReset = email => request({ url: '/account/request-reset', method: 'post', data: { email } })
export const completeEmailAction = data => request({ url: '/account/complete', method: 'post', data })

export const browserConnectionSettings = () => request({ url: '/account/browser-config' })
