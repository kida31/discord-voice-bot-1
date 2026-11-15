<script setup lang="ts">
import { computed, onMounted, ref } from "vue"

type NavigationItem =
  | "overview"
  | "profile"
  | "members"
  | "voices"
  | "languages"
  | "cache"
  | "logs"

type MemberFilter =
  | "all"
  | "with-alias"
  | "without-alias"
  | "me"

type MemberSort =
  | "name-asc"
  | "name-desc"
  | "username-asc"
  | "username-desc"
  | "alias-asc"
  | "alias-desc"
  | "alias-first"
  | "no-alias-first"

type HealthResponse = {
  status: string
  service: string
  timestamp: string
  startedAt: string
  uptimeSeconds: number
}

type DashboardStatusResponse = {
  startedAt: string
  uptimeSeconds: number
  discordReachable: boolean
  memberCount: number | null
  cache: {count: number; totalSizeBytes: number}
  recentEvents: AuditEvent[]
}

type AuditEvent = {
  id: string
  eventType: string
  category: string
  actorUserId?: string | null
  actorUsername?: string | null
  actorDisplayName: string | null
  targetId?: string | null
  targetName: string | null
  data?: unknown
  createdAt: string
}

type DiscordUser = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

type DiscordGuild = {
  id: string
  name: string | null
  iconUrl: string | null
  isMember: boolean
  isAdmin: boolean
}

type MeResponse =
  | {
      authenticated: true
      user: DiscordUser
      guild: DiscordGuild
    }
  | {
      authenticated: false
    }

type AliasResponse = {
  alias: string | null
  maxLength: number
}

type AliasUpdateResponse = {
  success?: boolean
  alias?: string
  error?: string
}

type AdminMember = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  alias: string | null
}

type MembersResponse = {
  members: AdminMember[]
  count: number
  maxAliasLength: number
}

type AdminVoice = {
  key: string
  id: string
  name: string
  description: string | null
  compatibleLanguages: string[]
  selected: boolean
}

type VoicesResponse = {
  readOnly: boolean
  selectedVoiceId: string | null
  selectedVoice: AdminVoice | null
  voices: AdminVoice[]
  count: number
}

type AdminConfigResponse = {
  readOnly: boolean
  voiceProvider: string
  voiceId: string | null
  voiceName: string | null
  voiceLanguage: string | null
  textLanguage: string | null
}

type CacheUser = {
  guildId: string
  userId: string
  username: string
  displayName: string
  firstUsedAt: string
  lastUsedAt: string
}

type CacheEntry = {
  id: string
  extension: string
  sizeBytes: number
  createdAt: string
  lastUsedAt: string
  provider: string | null
  sentence: string | null
  voiceId: string | null
  language: string | null
  model: string | null
  users: CacheUser[]
  legacy: boolean
}

type CacheResponse = {
  directory: string
  entries: CacheEntry[]
  count: number
  totalSizeBytes: number
  averageSizeBytes: number
  oldestAt: string | null
  newestAt: string | null
}

type NavigationEntry = {
  id: NavigationItem
  label: string
  admin?: boolean
}

const API_URL = "http://localhost:3000"

const activePage = ref<NavigationItem>("overview")

const backendOnline = ref(false)
const backendLoading = ref(true)
const dashboardUptime = ref(0)
const discordReachable = ref(false)
const serverMemberCount = ref<number | null>(null)
const overviewCacheCount = ref(0)
const overviewCacheSize = ref(0)
const recentAuditEvents = ref<AuditEvent[]>([])

const currentUser = ref<DiscordUser | null>(null)
const currentGuild = ref<DiscordGuild | null>(null)
const authLoading = ref(true)

const alias = ref("")
const aliasMaxLength = ref(64)
const aliasLoading = ref(false)
const aliasSaving = ref(false)
const aliasMessage = ref("")
const aliasError = ref("")

const members = ref<AdminMember[]>([])
const membersLoading = ref(false)
const membersLoaded = ref(false)
const membersError = ref("")

const memberSearch = ref("")
const memberFilter = ref<MemberFilter>("all")
const memberSort = ref<MemberSort>("name-asc")

const memberAliasDrafts = ref<Record<string, string>>({})
const memberSavingIds = ref<Set<string>>(new Set())
const memberMessages = ref<Record<string, string>>({})
const memberErrors = ref<Record<string, string>>({})

const voices = ref<AdminVoice[]>([])
const voicesLoading = ref(false)
const voicesLoaded = ref(false)
const voicesError = ref("")
const voicesReadOnly = ref(true)
const selectedVoiceId = ref<string | null>(null)
const voiceSearch = ref("")
const voiceLanguageFilter = ref("all")

const configLoading = ref(false)
const configLoaded = ref(false)
const configError = ref("")
const voiceLanguage = ref<string | null>(null)
const textLanguage = ref<string | null>(null)

const cacheEntries = ref<CacheEntry[]>([])
const cacheDirectory = ref("")
const cacheLoading = ref(false)
const cacheLoaded = ref(false)
const cacheDeleting = ref(false)
const cacheError = ref("")
const cacheMessage = ref("")
const cacheTotalSize = ref(0)
const cacheAverageSize = ref(0)
const cacheOldestAt = ref<string | null>(null)
const cacheNewestAt = ref<string | null>(null)
const selectedCacheIds = ref<Set<string>>(new Set())
const cacheSearch = ref("")
const cacheUserFilter = ref("all")
const cacheVoiceFilter = ref("all")
const cacheLanguageFilter = ref("all")
const cacheSort = ref("recent")

const auditEvents = ref<AuditEvent[]>([])
const auditLoading = ref(false)
const auditLoaded = ref(false)
const auditError = ref("")
const auditSearch = ref("")

const previewTexts: Record<string, string> = {
  de: "Hallo! So klingt diese Stimme im L-F-Ants TTS-Bot.",
  en: "Hello! This is what this voice sounds like in the L-F-Ants TTS bot.",
  ja: "こんにちは！L-F-Ants TTSボットでは、この音声はこのように聞こえます。",
  vi: "Xin chào! Đây là giọng nói này trong bot TTS L-F-Ants.",
  ko: "안녕하세요! L-F-Ants TTS 봇에서 이 목소리는 이렇게 들립니다.",
}

const previewLanguage = ref("en")
const previewText = ref(previewTexts.en ?? "")
const previewVoiceId = ref<string | null>(null)
const previewLoadingVoiceId = ref<string | null>(null)
const previewError = ref("")
const previewAudioUrl = ref<string | null>(null)

const navigation: NavigationEntry[] = [
  {
    id: "overview",
    label: "Übersicht",
  },
  {
    id: "profile",
    label: "Mein Profil",
  },
  {
    id: "members",
    label: "Mitglieder",
    admin: true,
  },
  {
    id: "voices",
    label: "Stimmen",
    admin: true,
  },
  {
    id: "languages",
    label: "Sprachen",
    admin: true,
  },
  {
    id: "cache",
    label: "TTS Cache",
    admin: true,
  },
  {
    id: "logs",
    label: "Audit Log",
    admin: true,
  },
]

const backendStatusText = computed(() => {
  if (backendLoading.value) {
    return "Prüfe..."
  }

  return backendOnline.value
    ? "Online"
    : "Offline"
})

const visibleNavigation = computed(() => {
  return navigation.filter((item) => {
    if (!item.admin) {
      return true
    }

    return currentGuild.value?.isAdmin === true
  })
})

const activePageLabel = computed(() => {
  return navigation.find(
    (item) => item.id === activePage.value
  )?.label ?? "Dashboard"
})

const membersWithAliasCount = computed(() => {
  return members.value.filter(
    (member) => Boolean(member.alias?.trim())
  ).length
})

const membersWithoutAliasCount = computed(() => {
  return (
    members.value.length -
    membersWithAliasCount.value
  )
})

const filtersAreActive = computed(() => {
  return (
    memberSearch.value.trim().length > 0 ||
    memberFilter.value !== "all" ||
    memberSort.value !== "name-asc"
  )
})

const filteredMembers = computed(() => {
  const search =
    memberSearch.value
      .trim()
      .toLocaleLowerCase("de")

  let result = members.value.filter((member) => {
    const savedAlias =
      member.alias?.trim() ?? ""

    const draftAlias =
      memberAliasDrafts.value[member.id]
        ?.trim() ?? ""

    switch (memberFilter.value) {
      case "with-alias":
        if (!savedAlias) {
          return false
        }
        break

      case "without-alias":
        if (savedAlias) {
          return false
        }
        break

      case "me":
        if (member.id !== currentUser.value?.id) {
          return false
        }
        break

      case "all":
      default:
        break
    }

    if (!search) {
      return true
    }

    return (
      member.displayName
        .toLocaleLowerCase("de")
        .includes(search) ||
      member.username
        .toLocaleLowerCase("de")
        .includes(search) ||
      savedAlias
        .toLocaleLowerCase("de")
        .includes(search) ||
      draftAlias
        .toLocaleLowerCase("de")
        .includes(search)
    )
  })

  result = [...result]

  const compareName = (
    first: AdminMember,
    second: AdminMember
  ) => {
    return first.displayName.localeCompare(
      second.displayName,
      "de",
      {
        sensitivity: "base",
        numeric: true,
      }
    )
  }

  const compareUsername = (
    first: AdminMember,
    second: AdminMember
  ) => {
    return first.username.localeCompare(
      second.username,
      "de",
      {
        sensitivity: "base",
        numeric: true,
      }
    )
  }

  const compareAlias = (
    first: AdminMember,
    second: AdminMember
  ) => {
    return (first.alias ?? "").localeCompare(
      second.alias ?? "",
      "de",
      {
        sensitivity: "base",
        numeric: true,
      }
    )
  }

  switch (memberSort.value) {
    case "name-desc":
      result.sort(
        (first, second) =>
          compareName(second, first)
      )
      break

    case "username-asc":
      result.sort(compareUsername)
      break

    case "username-desc":
      result.sort(
        (first, second) =>
          compareUsername(second, first)
      )
      break

    case "alias-asc":
      result.sort((first, second) => {
        const firstHasAlias =
          Boolean(first.alias?.trim())

        const secondHasAlias =
          Boolean(second.alias?.trim())

        if (firstHasAlias !== secondHasAlias) {
          return firstHasAlias ? -1 : 1
        }

        return (
          compareAlias(first, second) ||
          compareName(first, second)
        )
      })
      break

    case "alias-desc":
      result.sort((first, second) => {
        const firstHasAlias =
          Boolean(first.alias?.trim())

        const secondHasAlias =
          Boolean(second.alias?.trim())

        if (firstHasAlias !== secondHasAlias) {
          return firstHasAlias ? -1 : 1
        }

        return (
          compareAlias(second, first) ||
          compareName(first, second)
        )
      })
      break

    case "alias-first":
      result.sort((first, second) => {
        const firstHasAlias =
          Boolean(first.alias?.trim())

        const secondHasAlias =
          Boolean(second.alias?.trim())

        if (firstHasAlias !== secondHasAlias) {
          return firstHasAlias ? -1 : 1
        }

        return compareName(first, second)
      })
      break

    case "no-alias-first":
      result.sort((first, second) => {
        const firstHasAlias =
          Boolean(first.alias?.trim())

        const secondHasAlias =
          Boolean(second.alias?.trim())

        if (firstHasAlias !== secondHasAlias) {
          return firstHasAlias ? 1 : -1
        }

        return compareName(first, second)
      })
      break

    case "name-asc":
    default:
      result.sort(compareName)
      break
  }

  return result
})

const selectedVoice = computed(() => {
  if (!selectedVoiceId.value) {
    return null
  }

  return voices.value.find(
    (voice) =>
      voice.id === selectedVoiceId.value
  ) ?? null
})

const availableVoiceLanguages = computed(() => {
  const languages =
    new Set<string>()

  for (const voice of voices.value) {
    for (
      const language of
      voice.compatibleLanguages
    ) {
      languages.add(language)
    }
  }

  return [...languages].sort(
    (first, second) =>
      first.localeCompare(
        second,
        "de",
        {
          sensitivity: "base",
        }
      )
  )
})

const filteredVoices = computed(() => {
  const search =
    voiceSearch.value
      .trim()
      .toLocaleLowerCase("de")

  return voices.value.filter((voice) => {
    if (
      voiceLanguageFilter.value !== "all" &&
      !voice.compatibleLanguages.includes(
        voiceLanguageFilter.value
      )
    ) {
      return false
    }

    if (!search) {
      return true
    }

    const description =
      voice.description ?? ""

    return (
      voice.name
        .toLocaleLowerCase("de")
        .includes(search) ||
      voice.id
        .toLocaleLowerCase("de")
        .includes(search) ||
      voice.key
        .toLocaleLowerCase("de")
        .includes(search) ||
      description
        .toLocaleLowerCase("de")
        .includes(search) ||
      voice.compatibleLanguages.some(
        (language) =>
          language
            .toLocaleLowerCase("de")
            .includes(search)
      )
    )
  })
})

const availableCacheUsers = computed(() => {
  const users = new Map<string, string>()
  for (const entry of cacheEntries.value) {
    for (const user of entry.users) users.set(user.userId, user.displayName)
  }
  return [...users.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"))
})

const availableCacheVoices = computed(() => [...new Set(cacheEntries.value.map((entry) => entry.voiceId).filter(Boolean) as string[])].sort())
const availableCacheLanguages = computed(() => [...new Set(cacheEntries.value.map((entry) => entry.language).filter(Boolean) as string[])].sort())

const filteredCacheEntries = computed(() => {
  const search = cacheSearch.value.trim().toLocaleLowerCase("de")
  let result = cacheEntries.value.filter((entry) => {
    if (cacheUserFilter.value !== "all" && !entry.users.some((user) => user.userId === cacheUserFilter.value)) return false
    if (cacheVoiceFilter.value !== "all" && entry.voiceId !== cacheVoiceFilter.value) return false
    if (cacheLanguageFilter.value !== "all" && entry.language !== cacheLanguageFilter.value) return false
    if (!search) return true
    return (entry.sentence ?? "").toLocaleLowerCase("de").includes(search) ||
      (entry.language ?? "").toLocaleLowerCase("de").includes(search) ||
      (entry.voiceId ?? "").toLocaleLowerCase("de").includes(search) ||
      entry.users.some((user) => user.displayName.toLocaleLowerCase("de").includes(search) || user.username.toLocaleLowerCase("de").includes(search))
  })
  result = [...result]
  if (cacheSort.value === "oldest") result.sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt))
  else if (cacheSort.value === "largest") result.sort((a, b) => b.sizeBytes - a.sizeBytes)
  else if (cacheSort.value === "smallest") result.sort((a, b) => a.sizeBytes - b.sizeBytes)
  else result.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
  return result
})

const configurationWarning = computed(() => {
  if (!selectedVoice.value || !voiceLanguage.value) return null
  const language = voiceLanguage.value.toLocaleLowerCase("de")
  const compatible = selectedVoice.value.compatibleLanguages.map((value) => value.toLocaleLowerCase("de"))
  return compatible.includes(language)
    ? null
    : `${selectedVoice.value.name} ist für ${selectedVoice.value.compatibleLanguages.map((value) => value.toUpperCase()).join(", ")} hinterlegt. Die konfigurierte Ausgabesprache ${voiceLanguage.value.toUpperCase()} bleibt trotzdem erlaubt.`
})

const filteredAuditEvents = computed(() => {
  const search = auditSearch.value.trim().toLocaleLowerCase("de")
  if (!search) return auditEvents.value
  return auditEvents.value.filter((event) =>
    event.eventType.toLocaleLowerCase("de").includes(search) ||
    event.category.toLocaleLowerCase("de").includes(search) ||
    (event.actorDisplayName ?? "").toLocaleLowerCase("de").includes(search) ||
    (event.targetName ?? "").toLocaleLowerCase("de").includes(search)
  )
})

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(value: string | null): string {
  if (!value) return "Nicht verfügbar"
  return new Intl.DateTimeFormat("de-DE", {dateStyle: "medium", timeStyle: "short"}).format(new Date(value))
}

function resetAliasState() {
  alias.value = ""
  aliasMaxLength.value = 64
  aliasLoading.value = false
  aliasSaving.value = false
  aliasMessage.value = ""
  aliasError.value = ""
}

function resetMemberFilters() {
  memberSearch.value = ""
  memberFilter.value = "all"
  memberSort.value = "name-asc"
}

function resetMembersState() {
  members.value = []
  membersLoading.value = false
  membersLoaded.value = false
  membersError.value = ""
  resetMemberFilters()
  memberAliasDrafts.value = {}
  memberSavingIds.value = new Set()
  memberMessages.value = {}
  memberErrors.value = {}
}

function resetVoicesState() {
  voices.value = []
  voicesLoading.value = false
  voicesLoaded.value = false
  voicesError.value = ""
  voicesReadOnly.value = true
  selectedVoiceId.value = null
  voiceSearch.value = ""
  voiceLanguageFilter.value = "all"
}

function resetConfigState() {
  configLoading.value = false
  configLoaded.value = false
  configError.value = ""
  voiceLanguage.value = null
  textLanguage.value = null
}

function resetCacheState() {
  cacheEntries.value = []
  cacheDirectory.value = ""
  cacheLoading.value = false
  cacheLoaded.value = false
  cacheDeleting.value = false
  cacheError.value = ""
  cacheMessage.value = ""
  cacheTotalSize.value = 0
  cacheAverageSize.value = 0
  cacheOldestAt.value = null
  cacheNewestAt.value = null
  selectedCacheIds.value = new Set()
  cacheSearch.value = ""
}

function isMemberSaving(
  userId: string
): boolean {
  return memberSavingIds.value.has(userId)
}

function setMemberSaving(
  userId: string,
  saving: boolean
) {
  const updated =
    new Set(memberSavingIds.value)

  if (saving) {
    updated.add(userId)
  } else {
    updated.delete(userId)
  }

  memberSavingIds.value = updated
}

function clearMemberFeedback(
  userId: string
) {
  const updatedMessages = {
    ...memberMessages.value,
  }

  const updatedErrors = {
    ...memberErrors.value,
  }

  delete updatedMessages[userId]
  delete updatedErrors[userId]

  memberMessages.value =
    updatedMessages

  memberErrors.value =
    updatedErrors
}

function setMemberMessage(
  userId: string,
  message: string
) {
  memberMessages.value = {
    ...memberMessages.value,
    [userId]: message,
  }

  const updatedErrors = {
    ...memberErrors.value,
  }

  delete updatedErrors[userId]

  memberErrors.value =
    updatedErrors
}

function setMemberError(
  userId: string,
  message: string
) {
  memberErrors.value = {
    ...memberErrors.value,
    [userId]: message,
  }

  const updatedMessages = {
    ...memberMessages.value,
  }

  delete updatedMessages[userId]

  memberMessages.value =
    updatedMessages
}

async function selectPage(
  page: NavigationItem
) {
  const entry =
    navigation.find(
      (item) => item.id === page
    )

  if (
    entry?.admin &&
    currentGuild.value?.isAdmin !== true
  ) {
    activePage.value = "overview"
    return
  }

  activePage.value = page

  if (
    page === "members" &&
    !membersLoaded.value &&
    !membersLoading.value
  ) {
    await loadMembers()
  }

  if (
    page === "voices" &&
    !voicesLoaded.value &&
    !voicesLoading.value
  ) {
    await loadVoices()
  }

  if (
    page === "languages" &&
    !configLoaded.value &&
    !configLoading.value
  ) {
    await loadConfig()
  }

  if (
    page === "cache" &&
    !cacheLoaded.value &&
    !cacheLoading.value
  ) {
    await loadCache()
  }

  if (page === "logs" && !auditLoaded.value && !auditLoading.value) {
    await loadAuditEvents()
  }
}

async function checkBackendHealth() {
  backendLoading.value = true

  try {
    const response = await fetch(
      `${API_URL}/api/health`
    )

    if (!response.ok) {
      throw new Error(
        `Health endpoint returned ${response.status}`
      )
    }

    const health = await response.json() as HealthResponse

    backendOnline.value =
      health.status === "ok"
  } catch (error) {
    console.error(
      "Dashboard API is unavailable:",
      error
    )

    backendOnline.value = false
  } finally {
    backendLoading.value = false
  }
}

async function loadAlias() {
  if (!currentUser.value) {
    resetAliasState()
    return
  }

  aliasLoading.value = true
  aliasMessage.value = ""
  aliasError.value = ""

  try {
    const response = await fetch(
      `${API_URL}/api/me/alias`,
      {
        credentials: "include",
      }
    )

    if (!response.ok) {
      throw new Error(
        `Alias endpoint returned ${response.status}`
      )
    }

    const result = await response.json() as AliasResponse

    alias.value =
      result.alias ?? ""

    aliasMaxLength.value =
      result.maxLength
  } catch (error) {
    console.error(
      "Could not load TTS alias:",
      error
    )

    aliasError.value =
      "Alias konnte nicht geladen werden."
  } finally {
    aliasLoading.value = false
  }
}

async function loadCurrentUser() {
  authLoading.value = true

  try {
    const response = await fetch(
      `${API_URL}/api/me`,
      {
        credentials: "include",
      }
    )

    if (response.status === 401) {
      currentUser.value = null
      currentGuild.value = null
      activePage.value = "overview"
      resetAliasState()
      resetMembersState()
      resetVoicesState()
      resetConfigState()
      return
    }

    if (!response.ok) {
      throw new Error(
        `User endpoint returned ${response.status}`
      )
    }

    const result = await response.json() as MeResponse

    if (result.authenticated) {
      currentUser.value = result.user
      currentGuild.value = result.guild

      if (!result.guild.isAdmin) {
        resetMembersState()
        resetVoicesState()
        resetConfigState()
      }

      await loadAlias()
      await loadDashboardStatus()

      if (result.guild.isMember) {
        await Promise.all([
          loadVoices(),
          loadConfig(),
        ])
      }
    } else {
      currentUser.value = null
      currentGuild.value = null
      activePage.value = "overview"
      resetAliasState()
      resetMembersState()
      resetVoicesState()
      resetConfigState()
    }
  } catch (error) {
    console.error(
      "Could not load Discord user:",
      error
    )

    currentUser.value = null
    currentGuild.value = null
    activePage.value = "overview"
    resetAliasState()
    resetMembersState()
    resetVoicesState()
    resetConfigState()
  } finally {
    authLoading.value = false
  }
}

async function saveAlias() {
  const value =
    alias.value.trim()

  aliasMessage.value = ""
  aliasError.value = ""

  if (!currentUser.value) {
    aliasError.value =
      "Bitte melde dich zuerst mit Discord an."
    return
  }

  if (!value) {
    aliasError.value =
      "Bitte gib einen Alias ein."
    return
  }

  if (value.length > aliasMaxLength.value) {
    aliasError.value =
      `Der Alias darf maximal ${aliasMaxLength.value} Zeichen lang sein.`
    return
  }

  aliasSaving.value = true

  try {
    const response = await fetch(
      `${API_URL}/api/me/alias`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          alias: value,
        }),
      }
    )

    const result = await response.json() as AliasUpdateResponse

    if (!response.ok) {
      throw new Error(
        result.error ??
        "Alias konnte nicht gespeichert werden."
      )
    }

    alias.value =
      result.alias ?? value

    aliasMessage.value =
      "Alias wurde gespeichert."

    const ownMember =
      members.value.find(
        (member) =>
          member.id === currentUser.value?.id
      )

    if (ownMember) {
      ownMember.alias = alias.value

      memberAliasDrafts.value = {
        ...memberAliasDrafts.value,
        [ownMember.id]: alias.value,
      }
    }
  } catch (error) {
    console.error(
      "Could not save TTS alias:",
      error
    )

    aliasError.value =
      "Alias konnte nicht gespeichert werden."
  } finally {
    aliasSaving.value = false
  }
}

async function removeAlias() {
  if (!currentUser.value) {
    return
  }

  aliasMessage.value = ""
  aliasError.value = ""
  aliasSaving.value = true

  try {
    const response = await fetch(
      `${API_URL}/api/me/alias`,
      {
        method: "DELETE",
        credentials: "include",
      }
    )

    if (!response.ok) {
      throw new Error(
        `Alias deletion returned ${response.status}`
      )
    }

    alias.value = ""

    aliasMessage.value =
      "Alias wurde gelöscht."

    const ownMember =
      members.value.find(
        (member) =>
          member.id === currentUser.value?.id
      )

    if (ownMember) {
      ownMember.alias = null

      memberAliasDrafts.value = {
        ...memberAliasDrafts.value,
        [ownMember.id]: "",
      }
    }
  } catch (error) {
    console.error(
      "Could not delete TTS alias:",
      error
    )

    aliasError.value =
      "Alias konnte nicht gelöscht werden."
  } finally {
    aliasSaving.value = false
  }
}

async function loadMembers(
  force = false
) {
  if (
    currentGuild.value?.isAdmin !== true
  ) {
    membersError.value =
      "Für diesen Bereich werden Administratorrechte benötigt."
    return
  }

  if (
    membersLoading.value ||
    (membersLoaded.value && !force)
  ) {
    return
  }

  membersLoading.value = true
  membersError.value = ""

  try {
    const response = await fetch(
      `${API_URL}/api/admin/members`,
      {
        credentials: "include",
      }
    )

    if (response.status === 403) {
      throw new Error(
        "Administrator permission required"
      )
    }

    if (!response.ok) {
      throw new Error(
        `Members endpoint returned ${response.status}`
      )
    }

    const result = await response.json() as MembersResponse

    members.value =
      result.members

    aliasMaxLength.value = result.maxAliasLength

    const drafts: Record<string, string> = {}

    for (const member of result.members) {
      drafts[member.id] =
        member.alias ?? ""
    }

    memberAliasDrafts.value =
      drafts

    memberMessages.value = {}
    memberErrors.value = {}
    membersLoaded.value = true
  } catch (error) {
    console.error(
      "Could not load guild members:",
      error
    )

    membersError.value =
      error instanceof Error &&
      error.message ===
        "Administrator permission required"
        ? "Du besitzt keine Administratorberechtigung für diesen Bereich."
        : "Die Mitglieder konnten nicht geladen werden."
  } finally {
    membersLoading.value = false
  }
}

async function saveMemberAlias(
  member: AdminMember
) {
  clearMemberFeedback(member.id)

  const value = (
    memberAliasDrafts.value[member.id] ?? ""
  ).trim()

  if (!value) {
    setMemberError(
      member.id,
      "Bitte gib einen Alias ein."
    )
    return
  }

  if (value.length > aliasMaxLength.value) {
    setMemberError(
      member.id,
      `Der Alias darf maximal ${aliasMaxLength.value} Zeichen lang sein.`
    )
    return
  }

  setMemberSaving(member.id, true)

  try {
    const response = await fetch(
      `${API_URL}/api/admin/members/${encodeURIComponent(member.id)}/alias`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          alias: value,
        }),
      }
    )

    const result = await response.json() as AliasUpdateResponse

    if (!response.ok) {
      throw new Error(
        result.error ??
        "Alias konnte nicht gespeichert werden."
      )
    }

    member.alias =
      result.alias ?? value

    memberAliasDrafts.value = {
      ...memberAliasDrafts.value,
      [member.id]: member.alias,
    }

    if (
      member.id ===
      currentUser.value?.id
    ) {
      alias.value =
        member.alias
    }

    setMemberMessage(
      member.id,
      "Alias gespeichert."
    )
  } catch (error) {
    console.error(
      `Could not save alias for ${member.id}:`,
      error
    )

    setMemberError(
      member.id,
      "Alias konnte nicht gespeichert werden."
    )
  } finally {
    setMemberSaving(member.id, false)
  }
}

async function removeMemberAlias(
  member: AdminMember
) {
  clearMemberFeedback(member.id)
  setMemberSaving(member.id, true)

  try {
    const response = await fetch(
      `${API_URL}/api/admin/members/${encodeURIComponent(member.id)}/alias`,
      {
        method: "DELETE",
        credentials: "include",
      }
    )

    if (!response.ok) {
      throw new Error(
        `Alias deletion returned ${response.status}`
      )
    }

    member.alias = null

    memberAliasDrafts.value = {
      ...memberAliasDrafts.value,
      [member.id]: "",
    }

    if (
      member.id ===
      currentUser.value?.id
    ) {
      alias.value = ""
    }

    setMemberMessage(
      member.id,
      "Alias gelöscht."
    )
  } catch (error) {
    console.error(
      `Could not delete alias for ${member.id}:`,
      error
    )

    setMemberError(
      member.id,
      "Alias konnte nicht gelöscht werden."
    )
  } finally {
    setMemberSaving(member.id, false)
  }
}

async function loadVoices(
  force = false
) {
  if (
currentGuild.value?.isMember !== true
  ) {
    voicesError.value =
      "Für diese Informationen ist eine Servermitgliedschaft erforderlich."
    return
  }

  if (
    voicesLoading.value ||
    (voicesLoaded.value && !force)
  ) {
    return
  }

  voicesLoading.value = true
  voicesError.value = ""

  try {
    const response = await fetch(
      `${API_URL}/api/voices`,
      {
        credentials: "include",
      }
    )

    if (response.status === 403) {
      throw new Error(
        "Guild membership required"
      )
    }

    if (!response.ok) {
      throw new Error(
        `Voices endpoint returned ${response.status}`
      )
    }

    const result = await response.json() as VoicesResponse

    voices.value =
      result.voices

    voicesReadOnly.value =
      result.readOnly

    selectedVoiceId.value =
      result.selectedVoiceId

    voicesLoaded.value =
      true
  } catch (error) {
    console.error(
      "Could not load voices:",
      error
    )

    voicesError.value =
      error instanceof Error &&
      error.message ===
        "Guild membership required"
        ? "Du bist kein Mitglied des konfigurierten Discord-Servers."
        : "Die Stimmen konnten nicht geladen werden."
  } finally {
    voicesLoading.value = false
  }
}

async function loadConfig(
  force = false
) {
  if (
currentGuild.value?.isMember !== true
  ) {
    configError.value =
      "Für diese Informationen ist eine Servermitgliedschaft erforderlich."
    return
  }

  if (
    configLoading.value ||
    (configLoaded.value && !force)
  ) {
    return
  }

  configLoading.value = true
  configError.value = ""

  try {
    const response = await fetch(
      `${API_URL}/api/config`,
      {
        credentials: "include",
      }
    )

    if (response.status === 403) {
      throw new Error(
        "Guild membership required"
      )
    }

    if (!response.ok) {
      throw new Error(
        `Config endpoint returned ${response.status}`
      )
    }

    const result = await response.json() as AdminConfigResponse

    voiceLanguage.value =
      result.voiceLanguage

    if (result.voiceLanguage) {
      previewLanguage.value = result.voiceLanguage
      previewText.value =
        previewTexts[result.voiceLanguage.toLocaleLowerCase("de")]
        ?? previewText.value
    }

    textLanguage.value =
      result.textLanguage

    configLoaded.value = true
  } catch (error) {
    console.error(
      "Could not load guild configuration:",
      error
    )

    configError.value =
      error instanceof Error &&
      error.message ===
        "Guild membership required"
        ? "Du bist kein Mitglied des konfigurierten Discord-Servers."
        : "Die Sprachkonfiguration konnte nicht geladen werden."
  } finally {
    configLoading.value = false
  }
}

async function loadDashboardStatus() {
  if (!currentGuild.value?.isMember) return
  try {
    const response = await fetch(`${API_URL}/api/status`, {credentials: "include"})
    if (!response.ok) return
    const result = await response.json() as DashboardStatusResponse
    dashboardUptime.value = result.uptimeSeconds
    discordReachable.value = result.discordReachable
    serverMemberCount.value = result.memberCount
    overviewCacheCount.value = result.cache.count
    overviewCacheSize.value = result.cache.totalSizeBytes
    recentAuditEvents.value = result.recentEvents
  } catch (error) {
    console.error("Could not load dashboard status:", error)
  }
}

async function loadAuditEvents(force = false) {
  if (!currentGuild.value?.isAdmin || (auditLoaded.value && !force)) return
  auditLoading.value = true
  auditError.value = ""
  try {
    const response = await fetch(`${API_URL}/api/admin/events?limit=200`, {credentials: "include"})
    if (!response.ok) throw new Error(`Events endpoint returned ${response.status}`)
    const result = await response.json() as {events: AuditEvent[]}
    auditEvents.value = result.events
    auditLoaded.value = true
  } catch (error) {
    console.error("Could not load audit events:", error)
    auditError.value = "Audit-Log konnte nicht geladen werden."
  } finally {
    auditLoading.value = false
  }
}

function updatePreviewTextForLanguage() {
  previewText.value =
    previewTexts[previewLanguage.value.toLocaleLowerCase("de")]
    ?? previewText.value
}

async function previewVoice(voice: AdminVoice) {
  previewLoadingVoiceId.value = voice.id
  previewError.value = ""
  if (previewAudioUrl.value) URL.revokeObjectURL(previewAudioUrl.value)
  previewAudioUrl.value = null
  try {
    const response = await fetch(`${API_URL}/api/admin/voices/${encodeURIComponent(voice.id)}/preview`, {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({text: previewText.value, language: previewLanguage.value}),
    })
    if (!response.ok) throw new Error(`Preview endpoint returned ${response.status}`)
    previewAudioUrl.value = URL.createObjectURL(await response.blob())
    previewVoiceId.value = voice.id
  } catch (error) {
    console.error("Could not generate voice preview:", error)
    previewError.value = "Vorschau konnte nicht erzeugt werden."
  } finally {
    previewLoadingVoiceId.value = null
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

async function loadCache(force = false) {
  if (currentGuild.value?.isAdmin !== true) {
    cacheError.value = "Administratorrechte erforderlich."
    return
  }
  if (cacheLoading.value || (cacheLoaded.value && !force)) return
  cacheLoading.value = true
  cacheError.value = ""
  cacheMessage.value = ""
  try {
    const response = await fetch(`${API_URL}/api/admin/cache`, {credentials: "include"})
    if (!response.ok) throw new Error(`Cache endpoint returned ${response.status}`)
    const result = await response.json() as CacheResponse
    cacheEntries.value = result.entries
    cacheDirectory.value = result.directory
    cacheTotalSize.value = result.totalSizeBytes
    cacheAverageSize.value = result.averageSizeBytes
    cacheOldestAt.value = result.oldestAt
    cacheNewestAt.value = result.newestAt
    selectedCacheIds.value = new Set()
    cacheLoaded.value = true
  } catch (error) {
    console.error("Could not load TTS cache:", error)
    cacheError.value = "Der TTS-Cache konnte nicht geladen werden."
  } finally {
    cacheLoading.value = false
  }
}

function isCacheSelected(id: string): boolean {
  return selectedCacheIds.value.has(id)
}

function toggleCacheSelection(id: string) {
  const selected = new Set(selectedCacheIds.value)
  selected.has(id) ? selected.delete(id) : selected.add(id)
  selectedCacheIds.value = selected
}

function selectCacheByUser(userId: string) {
  const selected = new Set(selectedCacheIds.value)
  for (const entry of cacheEntries.value) {
    if (entry.users.some((user) => user.userId === userId)) selected.add(entry.id)
  }
  selectedCacheIds.value = selected
}

async function deleteCache(ids?: string[], all = false) {
  const count = all ? cacheEntries.value.length : ids?.length ?? 0
  if (count === 0) return
  const message = all
    ? `Wirklich den gesamten TTS-Cache mit ${count} Einträgen löschen?`
    : `Wirklich ${count} ausgewählte Cache-Einträge löschen?`
  if (!window.confirm(message)) return
  cacheDeleting.value = true
  cacheError.value = ""
  try {
    const response = await fetch(`${API_URL}/api/admin/cache`, {
      method: "DELETE",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(all ? {all: true} : {ids}),
    })
    if (!response.ok) throw new Error(`Cache deletion returned ${response.status}`)
    cacheLoaded.value = false
    await loadCache(true)
    await Promise.all([loadDashboardStatus(), loadAuditEvents(true)])
    cacheMessage.value = all ? "Der TTS-Cache wurde geleert." : "Die ausgewählten Einträge wurden gelöscht."
  } catch (error) {
    console.error("Could not delete TTS cache:", error)
    cacheError.value = "Cache-Einträge konnten nicht gelöscht werden."
  } finally {
    cacheDeleting.value = false
  }
}

function loginWithDiscord() {
  window.location.href =
    `${API_URL}/auth/discord`
}

async function logout() {
  try {
    await fetch(
      `${API_URL}/auth/logout`,
      {
        method: "POST",
        credentials: "include",
      }
    )
  } catch (error) {
    console.error(
      "Could not log out:",
      error
    )
  } finally {
    currentUser.value = null
    currentGuild.value = null
    activePage.value = "overview"
    resetAliasState()
    resetMembersState()
    resetVoicesState()
    resetConfigState()
    resetCacheState()
  }
}

onMounted(() => {
  void checkBackendHealth()
  void loadCurrentUser()
})
</script>

<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="brand">
        <div
          class="brand-icon"
          :class="{ 'has-server-icon': currentGuild?.iconUrl }"
        >
          <img
            v-if="currentGuild?.iconUrl"
            :src="currentGuild.iconUrl"
            :alt="`${currentGuild.name ?? 'Discord-Server'} Servericon`"
          />
          <span v-else>L</span>
        </div>

        <div>
          <strong>L-F-Ants</strong>
          <span>TTS Dashboard</span>
        </div>
      </div>

      <nav class="navigation">
        <button
          v-for="item in visibleNavigation"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ active: activePage === item.id }"
          @click="selectPage(item.id)"
        >
          <span>{{ item.label }}</span>

          <span
            v-if="item.admin"
            class="admin-badge"
          >
            Admin
          </span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <div class="user">
          <img
            v-if="currentUser?.avatarUrl"
            class="avatar avatar-image"
            :src="currentUser.avatarUrl"
            alt="Discord Avatar"
          />

          <div
            v-else
            class="avatar"
          >
            {{
              currentUser?.displayName
                ?.charAt(0)
                .toUpperCase()
                ?? "?"
            }}
          </div>

          <div class="user-info">
            <strong>
              {{
                currentUser?.displayName
                ?? "Discord User"
              }}
            </strong>

            <span v-if="currentUser">
              @{{ currentUser.username }}
            </span>

            <span v-else-if="authLoading">
              Wird geladen...
            </span>

            <span v-else>
              Noch nicht verbunden
            </span>
          </div>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <p class="eyebrow">
            L-F-Ants Bot
          </p>

          <h1>
            {{ activePageLabel }}
          </h1>
        </div>

        <button
          v-if="!currentUser"
          type="button"
          class="discord-button"
          @click="loginWithDiscord"
        >
          Mit Discord anmelden
        </button>

        <button
          v-else
          type="button"
          class="logout-button"
          @click="logout"
        >
          Abmelden
        </button>
      </header>

      <section
        v-if="activePage === 'overview'"
        class="content"
      >
        <div class="status-grid">
          <article class="card">
            <div class="card-header">
              <span>Backend-Status</span>

              <span
                class="status"
                :class="
                  backendOnline
                    ? 'online'
                    : 'offline'
                "
              >
                {{ backendStatusText }}
              </span>
            </div>

            <strong class="metric">
              L-F-Ants Dashboard
            </strong>

            <p>
              Das Dashboard-Backend ist
              {{
                backendOnline
                  ? " erreichbar."
                  : " nicht erreichbar."
              }}
            </p>
          </article>

          <article class="card">
            <div class="card-header">
              <span>TTS Provider</span>
            </div>

            <strong class="metric">
              ElevenLabs
            </strong>

            <p>
              Modell und Stimme werden später
              live vom Bot geladen.
            </p>
          </article>

          <article class="card">
            <div class="card-header">
              <span>TTS Cache</span>
            </div>

            <strong class="metric">
              Aktiv
            </strong>

            <p>
              Persistenter Opus-Cache auf dem
              Bot-Server.
            </p>
          </article>
          <article class="card">
            <div class="card-header"><span>Discord</span></div>
            <strong class="metric">{{ discordReachable ? "Verbunden" : "Nicht erreichbar" }}</strong>
            <p>{{ serverMemberCount ?? "?" }} Servermitglieder</p>
          </article>

          <article class="card">
            <div class="card-header"><span>Backend Uptime</span></div>
            <strong class="metric">{{ formatUptime(dashboardUptime) }}</strong>
            <p>Seit letztem Dashboard-Start</p>
          </article>

          <article class="card">
            <div class="card-header"><span>TTS Cache</span></div>
            <strong class="metric">{{ overviewCacheCount }} Dateien</strong>
            <p>{{ formatBytes(overviewCacheSize) }} belegt</p>
          </article>
        </div>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">
                Server
              </p>

              <h2>
                {{
                  currentGuild?.name
                  ?? "L-F-Ants"
                }}
              </h2>
            </div>

            <span
              class="status"
              :class="
                currentGuild?.isMember
                  ? 'online'
                  : 'offline'
              "
            >
              {{
                currentGuild?.isMember
                  ? "Mitglied"
                  : "Nicht verbunden"
              }}
            </span>
          </div>

          <div class="settings-grid">
            <div class="setting">
              <span>Voice</span>

              <strong>
                {{
                  selectedVoice?.name
                  ?? "Nicht konfiguriert"
                }}
              </strong>
            </div>

            <div class="setting">
              <span>Voice-Sprache</span>

              <strong>
                {{
                  voiceLanguage?.toUpperCase()
                  ?? "Nicht konfiguriert"
                }}
              </strong>
            </div>

            <div class="setting">
              <span>Text-Sprache</span>

              <strong>
                {{
                  textLanguage?.toUpperCase()
                  ?? "Nicht konfiguriert"
                }}
              </strong>
            </div>

            <div class="setting">
              <span>Zugriff</span>

              <strong v-if="currentGuild?.isAdmin">
                Serveradministrator
              </strong>

              <strong v-else-if="currentGuild?.isMember">
                Mitglied
              </strong>

              <strong v-else>
                Nicht angemeldet
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section
        v-else-if="activePage === 'profile'"
        class="content"
      >
        <article class="panel narrow">
          <p class="eyebrow">
            Persönliche Einstellung
          </p>

          <h2>
            Mein TTS-Alias
          </h2>

          <p class="description">
            Dieser Name wird vom Bot bei
            Voice-Ankündigungen ausgesprochen.
          </p>

          <div
            v-if="aliasLoading"
            class="profile-loading"
          >
            Alias wird geladen...
          </div>

          <template v-else>
            <label
              class="field"
              for="alias"
            >
              <span>Alias</span>

              <input
                id="alias"
                v-model="alias"
                type="text"
                :maxlength="aliasMaxLength"
                :disabled="
                  aliasSaving ||
                  !currentUser
                "
                placeholder="Noch kein Alias gesetzt"
                @keydown.enter.prevent="saveAlias"
              />

              <small class="field-hint">
                {{ alias.length }}
                /
                {{ aliasMaxLength }}
              </small>
            </label>

            <div class="form-actions">
              <button
                type="button"
                class="primary-button"
                :disabled="
                  aliasSaving ||
                  !currentUser
                "
                @click="saveAlias"
              >
                {{
                  aliasSaving
                    ? "Speichert..."
                    : "Speichern"
                }}
              </button>

              <button
                v-if="alias"
                type="button"
                class="secondary-danger-button"
                :disabled="aliasSaving"
                @click="removeAlias"
              >
                Alias löschen
              </button>
            </div>

            <p
              v-if="aliasMessage"
              class="form-message success"
            >
              {{ aliasMessage }}
            </p>

            <p
              v-if="aliasError"
              class="form-message error"
            >
              {{ aliasError }}
            </p>

            <p
              v-if="!currentUser"
              class="form-message error"
            >
              Bitte melde dich zuerst mit Discord an.
            </p>
          </template>
        </article>
      </section>

      <section
        v-else-if="
          activePage === 'members' &&
          currentGuild?.isAdmin === true
        "
        class="content"
      >
        <article class="panel members-panel">
          <div class="members-heading">
            <div>
              <p class="eyebrow">
                Administration
              </p>

              <h2>
                Mitglieder und Aliase
              </h2>

              <p class="description">
                Verwalte die gesprochenen
                TTS-Aliase der Discord-Mitglieder.
              </p>
            </div>

            <button
              type="button"
              class="refresh-button"
              :disabled="membersLoading"
              @click="loadMembers(true)"
            >
              {{
                membersLoading
                  ? "Lädt..."
                  : "Aktualisieren"
              }}
            </button>
          </div>

          <div class="members-toolbar">
            <div class="members-toolbar-controls">
              <label
                class="member-control member-search"
                for="member-search"
              >
                <span>
                  Mitglieder suchen
                </span>

                <input
                  id="member-search"
                  v-model="memberSearch"
                  type="search"
                  placeholder="Name, Username oder Alias"
                />
              </label>

              <label
                class="member-control"
                for="member-filter"
              >
                <span>Filter</span>

                <select
                  id="member-filter"
                  v-model="memberFilter"
                >
                  <option value="all">
                    Alle Mitglieder
                  </option>

                  <option value="with-alias">
                    Nur mit Alias
                    ({{ membersWithAliasCount }})
                  </option>

                  <option value="without-alias">
                    Ohne Alias
                    ({{ membersWithoutAliasCount }})
                  </option>

                  <option value="me">
                    Mein Account
                  </option>
                </select>
              </label>

              <label
                class="member-control"
                for="member-sort"
              >
                <span>Sortierung</span>

                <select
                  id="member-sort"
                  v-model="memberSort"
                >
                  <option value="name-asc">
                    Name A → Z
                  </option>

                  <option value="name-desc">
                    Name Z → A
                  </option>

                  <option value="username-asc">
                    Username A → Z
                  </option>

                  <option value="username-desc">
                    Username Z → A
                  </option>

                  <option value="alias-asc">
                    Alias A → Z
                  </option>

                  <option value="alias-desc">
                    Alias Z → A
                  </option>

                  <option value="alias-first">
                    Mit Alias zuerst
                  </option>

                  <option value="no-alias-first">
                    Ohne Alias zuerst
                  </option>
                </select>
              </label>
            </div>

            <div class="member-toolbar-summary">
              <button
                v-if="filtersAreActive"
                type="button"
                class="filters-reset-button"
                @click="resetMemberFilters"
              >
                Zurücksetzen
              </button>

              <span class="member-count">
                {{ filteredMembers.length }}
                von
                {{ members.length }}
                Mitgliedern
              </span>
            </div>
          </div>

          <div
            v-if="membersLoading"
            class="members-state"
          >
            Discord-Mitglieder werden geladen...
          </div>

          <div
            v-else-if="membersError"
            class="members-state error"
          >
            {{ membersError }}
          </div>

          <div
            v-else-if="
              membersLoaded &&
              filteredMembers.length === 0
            "
            class="members-state"
          >
            Keine passenden Mitglieder gefunden.
          </div>

          <div
            v-else
            class="member-list"
          >
            <article
              v-for="member in filteredMembers"
              :key="member.id"
              class="member-row"
            >
              <div class="member-identity">
                <img
                  v-if="member.avatarUrl"
                  class="member-avatar"
                  :src="member.avatarUrl"
                  alt=""
                />

                <div
                  v-else
                  class="member-avatar member-avatar-placeholder"
                >
                  {{
                    member.displayName
                      .charAt(0)
                      .toUpperCase()
                  }}
                </div>

                <div class="member-names">
                  <strong>
                    {{ member.displayName }}
                  </strong>

                  <span>
                    @{{ member.username }}
                  </span>

                  <span
                    v-if="
                      member.id === currentUser?.id
                    "
                    class="current-user-badge"
                  >
                    Du
                  </span>
                </div>
              </div>

              <div class="member-alias-control">
                <label
                  :for="`alias-${member.id}`"
                >
                  TTS-Alias
                </label>

                <div class="member-alias-input-row">
                  <input
                    :id="`alias-${member.id}`"
                    v-model="
                      memberAliasDrafts[member.id]
                    "
                    type="text"
                    :maxlength="aliasMaxLength"
                    :disabled="
                      isMemberSaving(member.id)
                    "
                    placeholder="Kein Alias gesetzt"
                    @keydown.enter.prevent="
                      saveMemberAlias(member)
                    "
                  />

                  <button
                    type="button"
                    class="member-save-button"
                    :disabled="
                      isMemberSaving(member.id)
                    "
                    @click="
                      saveMemberAlias(member)
                    "
                  >
                    {{
                      isMemberSaving(member.id)
                        ? "..."
                        : "Speichern"
                    }}
                  </button>

                  <button
                    v-if="
                      member.alias ||
                      memberAliasDrafts[member.id]
                    "
                    type="button"
                    class="member-delete-button"
                    :disabled="
                      isMemberSaving(member.id)
                    "
                    @click="
                      removeMemberAlias(member)
                    "
                  >
                    Löschen
                  </button>
                </div>

                <div class="member-alias-meta">
                  <span>
                    {{
                      (
                        memberAliasDrafts[member.id]
                        ?? ""
                      ).length
                    }}
                    /
                    {{ aliasMaxLength }}
                  </span>

                  <span
                    v-if="memberMessages[member.id]"
                    class="member-feedback success"
                  >
                    {{ memberMessages[member.id] }}
                  </span>

                  <span
                    v-if="memberErrors[member.id]"
                    class="member-feedback error"
                  >
                    {{ memberErrors[member.id] }}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </article>
      </section>

      <section
        v-else-if="
          activePage === 'voices' &&
          currentGuild?.isAdmin === true
        "
        class="content"
      >
        <article class="panel voices-panel">
          <div class="voices-heading">
            <div>
              <p class="eyebrow">
                Administration
              </p>

              <h2>
                ElevenLabs-Stimmen
              </h2>

              <p class="description">
                Diese Stimmen sind aktuell fest im
                Bot-Code konfiguriert. Die hinterlegten
                Sprachen zeigen nur, für welche Sprachen
                eine Stimme vorgesehen ist. Stimme und
                tatsächliche Ausgabesprache können
                unabhängig voneinander gewählt werden.
              </p>
            </div>

            <div class="voices-heading-actions">
              <span
                v-if="voicesReadOnly"
                class="readonly-badge"
              >
                Nur lesen
              </span>

              <button
                type="button"
                class="refresh-button"
                :disabled="voicesLoading"
                @click="loadVoices(true)"
              >
                {{
                  voicesLoading
                    ? "Lädt..."
                    : "Aktualisieren"
                }}
              </button>
            </div>
          </div>

          <div
            v-if="selectedVoice"
            class="selected-voice"
          >
            <div class="selected-voice-marker">
              Aktiv
            </div>

            <div>
              <span class="selected-voice-label">
                Aktuell verwendete Stimme
              </span>

              <strong>
                {{ selectedVoice.name }}
              </strong>

              <span>
                {{
                  selectedVoice.description
                  ?? "Keine Beschreibung"
                }}
              </span>
            </div>

            <code>
              {{ selectedVoice.id }}
            </code>
          </div>

          <div
            v-else-if="
              voicesLoaded &&
              selectedVoiceId
            "
            class="selected-voice warning"
          >
            <div>
              <span class="selected-voice-label">
                Konfigurierte Voice-ID nicht im Katalog
              </span>

              <strong>
                Unbekannte Stimme
              </strong>

              <code>
                {{ selectedVoiceId }}
              </code>
            </div>
          </div>

          <div
            v-else-if="
              voicesLoaded &&
              !selectedVoiceId
            "
            class="selected-voice warning"
          >
            <div>
              <span class="selected-voice-label">
                Aktuelle Konfiguration
              </span>

              <strong>
                Keine feste ElevenLabs-Stimme gesetzt
              </strong>

              <span>
                Der Bot verwendet aktuell die
                sprachbasierte Standardauswahl.
              </span>
            </div>
          </div>

          <div v-if="configurationWarning" class="config-warning">
            <strong>Hinweis zur Sprachkombination</strong>
            <span>{{ configurationWarning }}</span>
          </div>

          <div class="voice-preview-box">
            <div class="voice-preview-controls">
              <label class="voice-preview-text-control" for="voice-preview-text">
                <span>Vorschautext</span>
                <textarea id="voice-preview-text" v-model="previewText" maxlength="300" rows="2"></textarea>
              </label>

              <label class="voice-preview-language-control" for="voice-preview-language">
                <span>Vorschau-Sprache</span>
                <select
                  id="voice-preview-language"
                  v-model="previewLanguage"
                  @change="updatePreviewTextForLanguage"
                >
                  <option v-for="language in availableVoiceLanguages" :key="language" :value="language">
                    {{ language.toUpperCase() }}
                  </option>
                </select>
              </label>
            </div>
            <small>Beim Wechsel der Vorschau-Sprache wird auch der Beispieltext passend übersetzt. Der Text kann danach weiterhin frei bearbeitet werden. Die Serverkonfiguration wird nicht verändert und die Vorschau landet nicht im produktiven TTS-Cache.</small>
            <audio v-if="previewAudioUrl" :src="previewAudioUrl" controls autoplay></audio>
            <p v-if="previewError" class="form-message error">{{ previewError }}</p>
          </div>

          <div class="voices-toolbar">
            <label
              class="voice-control voice-search"
              for="voice-search"
            >
              <span>
                Stimmen durchsuchen
              </span>

              <input
                id="voice-search"
                v-model="voiceSearch"
                type="search"
                placeholder="Name, Beschreibung oder Voice-ID"
              />
            </label>

            <label
              class="voice-control"
              for="voice-language"
            >
              <span>
                Nach hinterlegter Sprache filtern
              </span>

              <select
                id="voice-language"
                v-model="voiceLanguageFilter"
              >
                <option value="all">
                  Alle hinterlegten Sprachen
                </option>

                <option
                  v-for="language in availableVoiceLanguages"
                  :key="language"
                  :value="language"
                >
                  {{ language.toUpperCase() }}
                </option>
              </select>
            </label>

            <span class="voice-count">
              {{ filteredVoices.length }}
              von
              {{ voices.length }}
              Stimmen
            </span>
          </div>

          <div
            v-if="voicesLoading"
            class="voices-state"
          >
            Stimmenkatalog wird geladen...
          </div>

          <div
            v-else-if="voicesError"
            class="voices-state error"
          >
            {{ voicesError }}
          </div>

          <div
            v-else-if="
              voicesLoaded &&
              filteredVoices.length === 0
            "
            class="voices-state"
          >
            Keine passenden Stimmen gefunden.
          </div>

          <div
            v-else
            class="voice-grid"
          >
            <article
              v-for="voice in filteredVoices"
              :key="voice.id"
              class="voice-card"
              :class="{
                selected: voice.selected
              }"
            >
              <div class="voice-card-heading">
                <div>
                  <span class="voice-key">
                    {{ voice.key }}
                  </span>

                  <h3>
                    {{ voice.name }}
                  </h3>
                </div>

                <span
                  v-if="voice.selected"
                  class="voice-selected-badge"
                >
                  Aktiv
                </span>
              </div>

              <p>
                {{
                  voice.description
                  ?? "Keine Beschreibung hinterlegt."
                }}
              </p>

              <div class="voice-languages">
                <span
                  v-for="language in voice.compatibleLanguages"
                  :key="language"
                >
                  {{ language.toUpperCase() }}
                </span>
              </div>

              <button
                type="button"
                class="voice-preview-button"
                :disabled="previewLoadingVoiceId !== null"
                @click="previewVoice(voice)"
              >
                {{ previewLoadingVoiceId === voice.id ? "Erzeuge Vorschau..." : "▶ Vorschau" }}
              </button>

              <div class="voice-id">
                <span>
                  Voice-ID
                </span>

                <code>
                  {{ voice.id }}
                </code>
              </div>
            </article>
          </div>
        </article>
      </section>

      <section
        v-else-if="
          activePage === 'languages' &&
          currentGuild?.isAdmin === true
        "
        class="content"
      >
        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">
                Administration
              </p>

              <h2>
                Sprachkonfiguration
              </h2>

              <p class="description">
                Die Voice-Sprache steuert die Aussprache.
                Die Text-Sprache steuert die Sprache der
                erzeugten beziehungsweise verarbeiteten Texte.
                Beide Einstellungen sind unabhängig von der
                ausgewählten ElevenLabs-Stimme.
              </p>
            </div>

            <div class="voices-heading-actions">
              <span class="readonly-badge">
                Nur lesen
              </span>

              <button
                type="button"
                class="refresh-button"
                :disabled="configLoading"
                @click="loadConfig(true)"
              >
                {{
                  configLoading
                    ? "Lädt..."
                    : "Aktualisieren"
                }}
              </button>
            </div>
          </div>

          <div
            v-if="configLoading"
            class="voices-state"
          >
            Sprachkonfiguration wird geladen...
          </div>

          <div
            v-else-if="configError"
            class="voices-state error"
          >
            {{ configError }}
          </div>

          <div
            v-else
            class="settings-grid"
          >
            <div class="setting">
              <span>Voice-Sprache</span>
              <strong>
                {{
                  voiceLanguage?.toUpperCase()
                  ?? "Nicht konfiguriert"
                }}
              </strong>
            </div>

            <div class="setting">
              <span>Text-Sprache</span>
              <strong>
                {{
                  textLanguage?.toUpperCase()
                  ?? "Nicht konfiguriert"
                }}
              </strong>
            </div>

            <div class="setting">
              <span>Aktuelle Voice</span>
              <strong>
                {{
                  selectedVoice?.name
                  ?? "Nicht konfiguriert"
                }}
              </strong>
            </div>

            <div class="setting">
              <span>Kopplung</span>
              <strong>Unabhängig</strong>
            </div>
          </div>
        </article>
      </section>

      <section
        v-else-if="
          activePage === 'cache' &&
          currentGuild?.isAdmin === true
        "
        class="content"
      >
        <article class="panel cache-panel">
          <div class="cache-heading">
            <div>
              <p class="eyebrow">Administration</p>
              <h2>TTS Cache</h2>
              <p class="description">Hashbasierte Ogg/Opus-Dateien mit Nutzungsmetadaten. Alte Dateien ohne JSON-Metadaten werden als Legacy angezeigt.</p>
            </div>
            <div class="cache-actions">
              <button type="button" class="refresh-button" :disabled="cacheLoading || cacheDeleting" @click="loadCache(true)">Aktualisieren</button>
              <button type="button" class="secondary-danger-button" :disabled="selectedCacheIds.size === 0 || cacheDeleting" @click="deleteCache([...selectedCacheIds])">Ausgewählte löschen</button>
              <button type="button" class="secondary-danger-button" :disabled="cacheEntries.length === 0 || cacheDeleting" @click="deleteCache(undefined, true)">Alles löschen</button>
            </div>
          </div>

          <div class="cache-summary">
            <div><span>Einträge</span><strong>{{ cacheEntries.length }}</strong></div>
            <div><span>Gesamtgröße</span><strong>{{ formatBytes(cacheTotalSize) }}</strong></div>
            <div><span>Durchschnitt</span><strong>{{ formatBytes(cacheAverageSize) }}</strong></div>
            <div><span>Neueste Nutzung</span><strong>{{ formatDate(cacheNewestAt) }}</strong></div>
          </div>

          <div class="cache-directory"><span>Verzeichnis</span><code>{{ cacheDirectory || "Wird geladen..." }}</code></div>
          <div class="cache-toolbar cache-toolbar-expanded">
            <input v-model="cacheSearch" type="search" placeholder="Text, User, Sprache oder Voice-ID suchen" />
            <select v-model="cacheUserFilter"><option value="all">Alle Verwendungen</option><option v-for="user in availableCacheUsers" :key="user[0]" :value="user[0]">{{ user[1] }}</option></select>
            <select v-model="cacheLanguageFilter"><option value="all">Alle Sprachen</option><option v-for="language in availableCacheLanguages" :key="language" :value="language">{{ language.toUpperCase() }}</option></select>
            <select v-model="cacheVoiceFilter"><option value="all">Alle Voices</option><option v-for="voice in availableCacheVoices" :key="voice" :value="voice">{{ voice.slice(0, 12) }}</option></select>
            <select v-model="cacheSort"><option value="recent">Zuletzt verwendet</option><option value="oldest">Älteste Nutzung</option><option value="largest">Größte zuerst</option><option value="smallest">Kleinste zuerst</option></select>
            <span>{{ filteredCacheEntries.length }} von {{ cacheEntries.length }} Einträgen</span>
          </div>
          <p v-if="cacheMessage" class="form-message success cache-feedback">{{ cacheMessage }}</p>
          <div v-if="cacheLoading" class="voices-state">Cache wird geladen...</div>
          <div v-else-if="cacheError" class="voices-state error">{{ cacheError }}</div>
          <div v-else-if="filteredCacheEntries.length === 0" class="voices-state">Keine Cache-Einträge gefunden.</div>
          <div v-else class="cache-list">
            <article v-for="entry in filteredCacheEntries" :key="entry.id" class="cache-row">
              <input type="checkbox" :checked="isCacheSelected(entry.id)" :aria-label="`Cache ${entry.id} auswählen`" @change="toggleCacheSelection(entry.id)" />
              <div class="cache-entry-main">
                <div class="cache-entry-title">
                  <strong>{{ entry.sentence ?? "Legacy-Cache ohne Textmetadaten" }}</strong>
                  <span v-if="entry.legacy" class="readonly-badge">Legacy</span>
                </div>
                <div class="cache-entry-meta">
                  <span>{{ entry.language?.toUpperCase() ?? "Sprache unbekannt" }}</span>
                  <span>{{ formatBytes(entry.sizeBytes) }}</span>
                  <span>{{ formatDate(entry.lastUsedAt) }}</span>
                  <code>{{ entry.id.slice(0, 12) }}</code>
                </div>
                <span class="cache-used-by-label">Verwendet von</span>
                <div class="cache-users">
                  <span v-if="entry.users.length === 0">Verwendung unbekannt (Legacy)</span>
                  <button v-for="user in entry.users" :key="`${entry.id}-${user.userId}`" type="button" @click="selectCacheByUser(user.userId)">
                    {{ user.displayName }} (@{{ user.username }})
                  </button>
                </div>
              </div>
              <button type="button" class="member-delete-button" :disabled="cacheDeleting" @click="deleteCache([entry.id])">Löschen</button>
            </article>
          </div>
        </article>
      </section>

      <section v-else-if="activePage === 'logs' && currentGuild?.isAdmin === true" class="content">
        <article class="panel audit-panel">
          <div class="audit-heading">
            <div><p class="eyebrow">Administration</p><h2>Audit Log</h2><p class="description">Nachvollziehbare Dashboard-Aktionen. Voice-Join/Leave-Events können später denselben Event-Store verwenden.</p></div>
            <button type="button" class="refresh-button" :disabled="auditLoading" @click="loadAuditEvents(true)">Aktualisieren</button>
          </div>
          <div class="audit-toolbar"><input v-model="auditSearch" type="search" placeholder="Aktion, Kategorie oder User suchen" /><span>{{ filteredAuditEvents.length }} Ereignisse</span></div>
          <div v-if="auditLoading" class="voices-state">Audit-Log wird geladen...</div>
          <div v-else-if="auditError" class="voices-state error">{{ auditError }}</div>
          <div v-else-if="filteredAuditEvents.length === 0" class="voices-state">Noch keine Audit-Ereignisse vorhanden.</div>
          <div v-else class="audit-list">
            <article v-for="event in filteredAuditEvents" :key="event.id" class="audit-row">
              <div><strong>{{ event.eventType }}</strong><span>{{ event.category }}</span></div>
              <div><strong>{{ event.actorDisplayName ?? "System" }}</strong><span v-if="event.targetName">→ {{ event.targetName }}</span></div>
              <time>{{ formatDate(event.createdAt) }}</time>
            </article>
          </div>
        </article>
      </section>

      <section
        v-else-if="
          currentGuild?.isAdmin === true
        "
        class="content"
      >
        <article class="panel">
          <p class="eyebrow">
            Administration
          </p>

          <h2>
            {{ activePageLabel }}
          </h2>

          <p class="description">
            Dieser Adminbereich wird im nächsten
            Schritt mit einer serverseitig
            geschützten Fastify-API verbunden.
          </p>
        </article>
      </section>

      <section
        v-else
        class="content"
      >
        <article class="panel narrow">
          <p class="eyebrow">
            Zugriff verweigert
          </p>

          <h2>
            Keine Administratorberechtigung
          </h2>

          <p class="description">
            Für diesen Bereich werden
            Administratorrechte auf dem
            Discord-Server benötigt.
          </p>
        </article>
      </section>
    </main>
  </div>
</template>