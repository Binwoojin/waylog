import { useCallback, useState } from 'react'
import { withdrawMyAccount } from '../api/userApi'

/*
 * 회원 탈퇴 상태 훅
 *
 * Design Ref: mypage-bookmarks.design.md §2.2 — 되돌릴 수 없는 동작이라 확인 다이얼로그 UI
 * (WithdrawalDialog)와 요청 상태를 분리해 둔다. 성공 여부만 돌려주고, 로그아웃 처리·이동은
 * 호출하는 쪽(MyPage)이 AuthContext를 통해 수행한다(이 훅은 AuthContext를 모른다).
 */
export function useWithdrawal() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const withdraw = useCallback(async password => {
    setIsPending(true)
    setError('')

    try {
      await withdrawMyAccount(password)
      return true
    } catch (withdrawError) {
      setError(withdrawError.message || '회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      return false
    } finally {
      setIsPending(false)
    }
  }, [])

  const resetError = useCallback(() => setError(''), [])

  return { isPending, error, withdraw, resetError }
}
