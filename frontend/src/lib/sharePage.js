import { isAbortError } from '../api/client'

/*
 * 현재 페이지 공유.
 *
 * 분기
 * - navigator.share가 있으면(모바일, Windows Chrome 등) 네이티브 공유 시트를 먼저 엽니다.
 * - 공유 시트를 열 수 없거나 실패하면 현재 URL을 클립보드에 복사합니다.
 *   PC에서도 공유가 되도록 기기(pointer)로 나누지 않습니다.
 *
 * 결과
 * - 'shared'    : 공유 시트에서 보냄. 시스템 UI가 결과를 보여 주므로 화면 문구는 두지 않습니다.
 * - 'copied'    : 링크 복사 성공 → "링크를 복사했습니다." 안내
 * - 'cancelled' : 사용자가 공유 시트를 닫음(AbortError). 취소는 실패가 아니므로 문구를 두지 않습니다.
 * - 'failed'    : 공유와 복사가 모두 실패 → "링크를 복사하지 못했습니다..." 안내
 *
 * 공유 시트 호출이 다른 오류로 실패하면 클립보드 복사로 폴백합니다.
 * 클립보드 API(navigator.clipboard)는 보안 컨텍스트에서만 동작하므로, 막힌 환경에서는 execCommand('copy')로 한 번 더 시도합니다.
 * 두 함수 모두 사용자 클릭(user activation) 안에서 동기적으로 시작되도록 await 전에 호출합니다.
 */
export async function sharePage({ title }) {
  const url = window.location.href

  if (canUseNativeShare()) {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      if (isAbortError(error)) return 'cancelled'
      console.warn('공유 시트를 열지 못해 링크 복사로 대신합니다.', error)
    }
  }

  return (await copyLink(url)) ? 'copied' : 'failed'
}

function canUseNativeShare() {
  return typeof navigator.share === 'function'
}

async function copyLink(url) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch (error) {
      console.warn('클립보드 API로 복사하지 못해 대체 방법을 시도합니다.', error)
    }
  }

  try {
    return copyWithExecCommand(url)
  } catch (error) {
    console.error('링크 복사에 실패했습니다.', error)
    return false
  }
}

// 비보안 컨텍스트처럼 navigator.clipboard가 막힌 환경을 위한 폴백입니다. 화면 밖의 textarea를 선택해 복사 명령을 실행합니다.
function copyWithExecCommand(text) {
  if (typeof document.execCommand !== 'function') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  const previouslyFocused = document.activeElement
  try {
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
  }
}
