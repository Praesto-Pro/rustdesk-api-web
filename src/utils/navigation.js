// Presentation only: route names and permission filtering remain backend-owned.
export const navigationSections = [
  { id: 'workspace', title: 'Workspace', names: ['MyPeer', 'MyAddressBookList', 'MyAddressBookCollection', 'MyTagList', 'MyShareRecordList'] },
  { id: 'fleet', title: 'Fleet', names: ['Peer', 'DeviceGroup', 'UserAddressBook', 'UserAddressBookName', 'UserTag'] },
  { id: 'activity', title: 'Activity', names: ['AuditConn', 'AuditFile', 'LoginLog', 'ShareRecord', 'MyLoginLog'] },
  { id: 'administration', title: 'Administration', names: ['UserList', 'UserGroup', 'Oauth', 'UserToken', 'ServerCmd'] },
  { id: 'account', title: 'Account', names: ['MyInfo'] },
]

const titles = {
  "MyPeer": "My devices",
  "MyAddressBookList": "My connections",
  "MyAddressBookCollection": "My address books",
  "MyTagList": "My tags",
  "MyShareRecordList": "My shared links",
  "Peer": "All devices",
  "DeviceGroup": "Device groups",
  "UserAddressBook": "All connections",
  "UserAddressBookName": "All address books",
  "UserTag": "All tags",
  "AuditConn": "Connection history",
  "AuditFile": "File transfers",
  "LoginLog": "Sign-in history",
  "ShareRecord": "Shared links",
  "MyLoginLog": "My sign-ins",
  "UserList": "Users",
  "UserGroup": "User groups",
  "Oauth": "Sign-in providers",
  "UserToken": "Access tokens",
  "ServerCmd": "Server settings",
  "MyInfo": "My account"
}

const descriptions = {
  MyPeer: 'Devices associated with your account.',
  Peer: 'Registered devices across your remote access environment.',
  MyAddressBookList: 'Saved connections and devices shared with you.',
  MyAddressBookCollection: 'Organize your saved connections into address books.',
  MyTagList: 'Labels for your saved connections.',
  MyShareRecordList: 'Remote access links you have shared.',
  DeviceGroup: 'Organize registered devices into groups.',
  UserAddressBook: 'Manage saved connections across user accounts.',
  UserAddressBookName: 'Manage address books and their sharing rules.',
  UserTag: 'Manage connection labels across user accounts.',
  AuditConn: 'Review remote connection history.',
  AuditFile: 'Review file transfer activity.',
  LoginLog: 'Review sign-in activity across user accounts.',
  ShareRecord: 'Review shared remote access links.',
  MyLoginLog: 'Recent sign-in activity for your account.',
  UserList: 'Manage users and their access.',
  UserGroup: 'Manage user groups and device visibility.',
  Oauth: 'Configure the available sign-in providers.',
  UserToken: 'Manage access tokens for user accounts.',
  ServerCmd: 'Manage remote access server settings.',
  MyInfo: 'Your account details and connected sign-in providers.',
}

export function permittedLeaves(routes = []) {
  return routes.flatMap(route => {
    if (route.hidden || route.meta?.hide) return []
    if (Array.isArray(route.children)) return permittedLeaves(route.children)
    return route.name ? [route] : []
  })
}

export function buildNavigation(routes = []) {
  const available = new Map(permittedLeaves(routes).map(route => [route.name, route]))
  const groups = navigationSections.map(section => ({
    ...section,
    items: section.names.flatMap(name => {
      const route = available.get(name)
      if (!route) return []
      available.delete(name)
      return [{ name, title: titles[name] || route.meta?.title || name, icon: route.meta?.icon, description: descriptions[name] || '' }]
    }),
  })).filter(section => section.items.length)
  if (available.size) groups.push({
    id: 'more', title: 'More',
    items: [...available.values()].map(route => ({
      name: route.name, title: route.meta?.title || route.name, icon: route.meta?.icon, description: '',
    })),
  })
  return groups
}

export function activeNavigationName(route) {
  return ['UserAdd', 'UserEdit'].includes(route.name) ? 'UserList' : route.name
}

export function navigationContext(route, groups) {
  const activeName = activeNavigationName(route)
  const section = groups.find(group => group.items.some(item => item.name === activeName))
  const item = section?.items.find(entry => entry.name === activeName)
  return {
    section: section?.title || 'Workspace',
    title: route.name === activeName ? (item?.title || route.meta?.title || 'Page') : (route.meta?.title || 'Page'),
    description: route.name === activeName ? (item?.description || '') : '',
  }
}

export function defaultDestination(routes = []) {
  const leaves = permittedLeaves(routes)
  const preferred = ['MyPeer', 'Peer', 'MyAddressBookList', 'MyInfo']
  const destination = preferred.map(name => leaves.find(route => route.name === name)).find(Boolean) || leaves[0]
  return destination ? { name: destination.name } : null
}

export function postAuthenticationDestination(router, routes, redirect) {
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    const resolved = router.resolve(redirect)
    // Only named, authorized application routes are valid return destinations.
    if (resolved.name && !resolved.matched.at(-1)?.redirect && !['Login', 'Register'].includes(resolved.name)) return redirect
  }
  if (permittedLeaves(routes).some(route => route.name === 'MyInfo')) return { name: 'MyInfo' }
  return defaultDestination(routes) || '/404'
}
