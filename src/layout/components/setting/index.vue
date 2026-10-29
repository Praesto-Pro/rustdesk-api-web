<template>
  <div class="account-tools">
    <button type="button" class="icon-button" :aria-label="T(isDark ? 'Switch to light theme' : 'Switch to dark theme')"
      :title="T(isDark ? 'Switch to light theme' : 'Switch to dark theme')" @click="toggleTheme">
      <el-icon aria-hidden="true"><el-icon-sunny v-if="isDark" /><el-icon-moon v-else /></el-icon>
    </button>
    <el-dropdown trigger="click" @command="app.changeLang">
      <button type="button" class="icon-button language-button" :aria-label="T('Change language')" :title="T('Change language')">
        <span aria-hidden="true">Aa</span>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="(value, key) in app.setting.langs" :key="key" :command="key">
            <span class="language-choice"><span>{{ value.name }}</span><span v-if="key === app.setting.lang" aria-hidden="true">✓</span></span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-dropdown trigger="click" @command="accountAction">
      <button type="button" class="account-button" :aria-label="T('Account menu')">
        <span class="account-initials" aria-hidden="true">{{ initials }}</span>
        <span class="account-name">{{ user.username || user.nickname || T('Account') }}</span>
        <el-icon aria-hidden="true"><el-icon-arrow-down /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="hasProfile" command="profile">{{ T('Userinfo') }}</el-dropdown-item>
          <el-dropdown-item command="password">{{ T('ChangePassword') }}</el-dropdown-item>
          <el-dropdown-item command="logout" divided>{{ T('Logout') }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <ChangePwdDialog v-model:visible="changePwdVisible" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'
import { useRouteStore } from '@/store/router'
import { permittedLeaves } from '@/utils/navigation'
import { isDark, toggleTheme } from '@/utils/appearance'
import { T } from '@/utils/i18n'
import ChangePwdDialog from '@/components/changePwdDialog.vue'
const router = useRouter()
const user = useUserStore()
const app = useAppStore()
const routeStore = useRouteStore()
const changePwdVisible = ref(false)
const hasProfile = computed(() => permittedLeaves(routeStore.routes).some(route => route.name === 'MyInfo'))
const initials = computed(() => (user.nickname || user.username || 'P').slice(0, 2).toUpperCase())
function accountAction(command) {
  if (command === 'profile') router.push({ name: 'MyInfo' })
  if (command === 'password') changePwdVisible.value = true
  if (command === 'logout') { user.logout(); window.location.reload() }
}
</script>

<style scoped>
.account-tools { display: flex; gap: 4px; align-items: center; flex: none; }
.language-button { font-size: 14px; font-weight: 600; }
.language-choice { display: flex; width: 130px; align-items: center; justify-content: space-between; gap: 12px; }
.account-button { display: flex; align-items: center; gap: 8px; background: transparent; color: var(--prc-text); border: 0; border-radius: 6px; min-height: 36px; padding: 4px 6px; cursor: pointer; font-size: 13px; }
.account-button:hover { background: var(--prc-hover); }
.account-initials { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--prc-active); font-size: 11px; font-weight: 600; }
.account-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-button .el-icon { font-size: 12px; }
@media (max-width: 1100px) { .account-tools { justify-content: space-between; width: 100%; } .account-button { min-height: 44px; } }
</style>
