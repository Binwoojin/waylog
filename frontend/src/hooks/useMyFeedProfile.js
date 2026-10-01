import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchMyFeedProfile, updateMyFeedProfile } from '../api/feedApi'

/*
 * 내 피드 프로필 조회/수정 상태 훅
 *
 * Design Ref: mypage-bookmarks.design.md §2.2 — useFeedUserProfile(타인 프로필, 공개 조회 전용)과
 * 달리 인증이 필요하고 PATCH를 보유한다. userId 파라미터 없이 로그인한 본인만 조회한다.
 *
 * status: 'loading' | 'success' | 'login-required' | 'error'
 */
export function useMyFeedProfile(page = 1) {
  const [state, setState] = useState({ status: 'loading', profile: null })
  const [attempt, setAttempt] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    fetchMyFeedProfile({ page }, { signal: controller.signal })
      .then(profile => {
        if (isActive) setState({ status: 'success', profile })
      })
      .catch(error => {
        if (!isActive) return
        if (isAbortError(error)) return

        if (error instanceof ApiError && error.status === 401) {
          setState({ status: 'login-required', profile: null })
          return
        }

        console.error('내 프로필 정보를 불러오지 못했습니다.', error)
        setState({ status: 'error', profile: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [page, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', profile: null })
    setAttempt(value => value + 1)
  }, [])

  /*
   * 프로필 수정 저장.
   *
   * Design Ref: §4.2 — PATCH 응답은 posts/통계가 0으로 비워진 FeedProfileResponse다
   * (서비스가 목록을 다시 조회하지 않기 때문). 그래서 응답 전체로 state를 덮어쓰지 않고
   * 수정 대상 필드(닉네임·소개·피드아이디·프로필이미지)만 기존 profile에 겹쳐 반영한다.
   *
   * 실패 시 saveError에 서버 메시지(닉네임/피드아이디 중복 등)를 담아 폼이 계속 보여줄 수 있게 한다.
   */
  const saveProfile = useCallback(async ({ nickname, introduce, feedHandle, profileImageFile }) => {
    setIsSaving(true)
    setSaveError('')

    try {
      const updated = await updateMyFeedProfile({ nickname, introduce, feedHandle, profileImageFile })
      setState(current => {
        if (!current.profile) return current
        return {
          ...current,
          profile: {
            ...current.profile,
            nickname: updated.nickname,
            introduce: updated.introduce,
            feedHandle: updated.feedHandle,
            profileImageUrl: updated.profileImageUrl,
          },
        }
      })
      return true
    } catch (error) {
      setSaveError(error.message || '프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { ...state, retry, isSaving, saveError, saveProfile }
}
