import { router } from '@/router'
import { useRouteStore } from '@/store/router'
import { useUserStore } from '@/store/user'
import { getToken } from '@/utils/auth'
import { pinia } from '@/store'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css'
import { useAppStore } from '@/store/app' // progress bar style
import { T } from '@/utils/i18n'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ['/login', '/register', '/email']
const routeStore = useRouteStore(pinia)
const appStore = useAppStore(pinia)
appStore.getAdminConfig()
router.beforeEach(async (to, from, next) => {

  document.title = T(to.meta?.title) + ' - ' + appStore.setting.title
  NProgress.start()

  const token = getToken()
  if (!token) {
    //Redirect to sign-in when no token is available
    if (whiteList.indexOf(to.path) !== -1) {
      next()
    } else {
      next(`/login?redirect=${to.path}`)
    }

  } else {
    //A token is available

    const userStore = useUserStore(pinia)

    if (!userStore.sessionLoaded) {
      const info = await userStore.info()
      if (!info) {
        userStore.logout()
        next(`/login?redirect=${to.path}`)
      } else {
        next({ ...to, replace: true })
      }
    }/* else if (to.path === '/404') {
      next({path: to.redirectedFrom?.fullPath, replace: true})
    }*/ else {
      next()
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})
