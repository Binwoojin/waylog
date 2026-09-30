import { useId, useState } from 'react'
import './FeedCommentForm.css'

const MAX_LENGTH = 500

/**
 * 댓글/답글 입력 폼 (최상위 댓글·인라인 답글 입력 모두 이 컴포넌트를 재사용한다)
 *
 * Design Ref: feed-comment-integration.design.md §6.3 — 답글 모드 여부는 `isReply`로 명시적으로
 * 받는다(취소 버튼 노출 여부와 별개 의미). `onCancel`은 순수하게 "취소 버튼 클릭 핸들러"로만
 * 쓴다 — 이전 구현은 onCancel의 존재 여부로 답글 모드를 암묵적으로 판별해, 최상위 입력에도
 * 취소 버튼이 필요해지는 순간 그 결합이 깨지는 문제가 있었다(코드 리뷰 Should Improve).
 * Q-4(낙관적 업데이트 미적용): onSubmit이 반환하는 Promise가 성공(resolve)했을 때만 입력창을
 * 비운다. 실패하면 입력값을 그대로 유지해 사용자가 다시 시도할 수 있게 한다.
 */
export default function FeedCommentForm({ placeholder, onSubmit, isReply = false, onCancel, isLoggedIn, requireLogin }) {
  const [content, setContent] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputId = useId()

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isLoggedIn) {
      requireLogin()
      return
    }

    const trimmed = content.trim()
    if (!trimmed || pending) return

    setPending(true)
    setError('')

    try {
      await onSubmit(trimmed)
      setContent('')
    } catch (submitError) {
      console.error('댓글 작성에 실패했습니다.', submitError)
      setError('댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="feed-comment-form" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="feed-comment-form__sr-label">{placeholder}</label>
      <textarea
        id={inputId}
        className="feed-comment-form__input"
        value={content}
        maxLength={MAX_LENGTH}
        placeholder={placeholder}
        onChange={event => setContent(event.target.value)}
        disabled={pending}
        rows={isReply ? 2 : 3}
      />
      <div className="feed-comment-form__actions">
        {onCancel && (
          <button type="button" className="feed-comment-form__cancel" onClick={onCancel} disabled={pending}>
            취소
          </button>
        )}
        <button type="submit" className="feed-comment-form__submit" disabled={pending || !content.trim()}>
          {pending ? '작성 중...' : '등록'}
        </button>
      </div>
      {error && <p className="feed-comment-form__error" role="alert">{error}</p>}
    </form>
  )
}
