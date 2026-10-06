import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sharePage } from '../../lib/sharePage'

// sharePage의 execCommand 폴백은 `instanceof HTMLElement`를 쓰므로 Node 환경에 빈 클래스를 하나 둡니다.
class FakeHTMLElement {
  focus() {}
}

const PAGE_URL = 'https://waylog.example/destinations/detail/1?type=12'

function abortError() {
  const error = new Error('share dismissed')
  error.name = 'AbortError'
  return error
}

// 텍스트area 하나를 만들고 선택·복사 동작을 흉내 냅니다.
function createTextarea() {
  return {
    value: '',
    style: {},
    setAttribute: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
  }
}

function stubEnvironment({ share, clipboard, execCommand = undefined } = {}) {
  const textarea = createTextarea()
  const body = {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  }
  const previouslyFocused = new FakeHTMLElement()
  previouslyFocused.focus = vi.fn()

  const navigatorStub = {}
  if (share !== undefined) navigatorStub.share = share
  if (clipboard !== undefined) navigatorStub.clipboard = clipboard

  vi.stubGlobal('navigator', navigatorStub)
  vi.stubGlobal('window', { location: { href: PAGE_URL } })
  vi.stubGlobal('document', {
    createElement: vi.fn(() => textarea),
    body,
    activeElement: previouslyFocused,
    execCommand,
  })

  return { textarea, body, previouslyFocused }
}

describe('sharePage', () => {
  beforeEach(() => {
    vi.stubGlobal('HTMLElement', FakeHTMLElement)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('navigator.share 사용 가능', () => {
    it('공유 시트에서 보내면 shared를 반환하고 title·현재 URL을 넘긴다', async () => {
      const share = vi.fn().mockResolvedValue(undefined)
      const writeText = vi.fn()
      stubEnvironment({ share, clipboard: { writeText } })

      const result = await sharePage({ title: '경복궁' })

      expect(result).toBe('shared')
      expect(share).toHaveBeenCalledWith({ title: '경복궁', url: PAGE_URL })
      expect(writeText).not.toHaveBeenCalled()
    })

    it('사용자가 공유 시트를 닫으면(AbortError) cancelled를 반환하고 복사로 넘어가지 않는다', async () => {
      const share = vi.fn().mockRejectedValue(abortError())
      const writeText = vi.fn()
      stubEnvironment({ share, clipboard: { writeText } })

      const result = await sharePage({ title: '경복궁' })

      expect(result).toBe('cancelled')
      expect(writeText).not.toHaveBeenCalled()
    })

    it('AbortError가 아닌 오류로 실패하면 클립보드 복사로 대신한다', async () => {
      const share = vi.fn().mockRejectedValue(new TypeError('not allowed'))
      const writeText = vi.fn().mockResolvedValue(undefined)
      stubEnvironment({ share, clipboard: { writeText } })

      const result = await sharePage({ title: '경복궁' })

      expect(result).toBe('copied')
      expect(writeText).toHaveBeenCalledWith(PAGE_URL)
    })
  })

  describe('navigator.share 없음(PC 등)', () => {
    it('share가 없으면 공유 시트를 시도하지 않고 클립보드에 복사한다', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      stubEnvironment({ clipboard: { writeText } })

      const result = await sharePage({ title: '경복궁' })

      expect(result).toBe('copied')
      expect(writeText).toHaveBeenCalledWith(PAGE_URL)
    })

    it('클립보드 API가 실패하면 execCommand 폴백으로 복사하고, textarea를 정리하며 포커스를 되돌린다', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('insecure context'))
      const execCommand = vi.fn().mockReturnValue(true)
      const { textarea, body, previouslyFocused } = stubEnvironment({ clipboard: { writeText }, execCommand })

      const result = await sharePage({ title: '경복궁' })

      expect(result).toBe('copied')
      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(textarea.value).toBe(PAGE_URL)
      expect(textarea.setAttribute).toHaveBeenCalledWith('readonly', '')
      expect(body.appendChild).toHaveBeenCalledWith(textarea)
      expect(body.removeChild).toHaveBeenCalledWith(textarea)
      expect(previouslyFocused.focus).toHaveBeenCalled()
    })

    it('clipboard가 없고 execCommand도 false를 주면 failed를 반환한다', async () => {
      const execCommand = vi.fn().mockReturnValue(false)
      stubEnvironment({ execCommand })

      expect(await sharePage({ title: '경복궁' })).toBe('failed')
    })

    it('clipboard가 없고 execCommand 함수도 없으면 failed를 반환한다', async () => {
      stubEnvironment({ execCommand: undefined })

      expect(await sharePage({ title: '경복궁' })).toBe('failed')
    })

    it('execCommand가 예외를 던지면 failed를 반환하고 textarea는 그래도 제거한다', async () => {
      const execCommand = vi.fn(() => {
        throw new Error('blocked')
      })
      const { body, textarea } = stubEnvironment({ execCommand })

      expect(await sharePage({ title: '경복궁' })).toBe('failed')
      expect(body.removeChild).toHaveBeenCalledWith(textarea)
    })
  })
})
