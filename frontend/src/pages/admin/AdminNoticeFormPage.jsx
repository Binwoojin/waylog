import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAdminNoticeDetail } from '../../hooks/useAdminNoticeDetail'
import { createAdminNotice, updateAdminNotice } from '../../api/adminNoticeApi'
import './AdminNoticeFormPage.css'

/**
 * 관리자 공지사항 작성/수정 화면
 *
 * Design Ref: admin-dashboard.design.md §5.1, 계획 FR-N02, FR-N03
 * 라우트: /admin/notices/new(생성), /admin/notices/:id/edit(수정)
 */
export default function AdminNoticeFormPage() {
  const { id } = useParams()
  // Design Ref: useTourDetail·useAdminNoticeDetail 전제 — id가 바뀌면(다른 공지 수정 화면으로 이동)
  // 폼 state를 완전히 새로 시작하도록 key로 재마운트합니다.
  return <AdminNoticeForm key={id ?? 'new'} noticeId={id} />
}

function AdminNoticeForm({ noticeId }) {
  const isEditMode = Boolean(noticeId)
  const { member } = useAuth()
  const { status, notice, retry, hasRetried } = useAdminNoticeDetail(noticeId)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState(() => member?.nickname ?? '')
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /*
   * 상세 조회(수정 모드)가 성공하면 폼 값을 한 번만 채웁니다.
   *
   * useEffect에서 setState하면 react-hooks/set-state-in-effect에 걸리고, ref로 1회 실행을
   * 표시하면 react-hooks/refs(렌더 중 ref 읽기 금지)에 걸립니다. 대신 "마지막으로 반영한 notice"를
   * state로 기억해 두고 다른 객체가 오면(최초 로드 1회) 그때만 반영하는, React 공식 문서의
   * "렌더 중 상태 조정" 패턴을 씁니다. 부모가 noticeId별로 key를 다시 부여하므로,
   * 다른 공지로 이동하면 이 컴포넌트가 통째로 재마운트되어 appliedNotice도 초기화됩니다.
   */
  const [appliedNotice, setAppliedNotice] = useState(null)
  if (status === 'success' && notice && appliedNotice !== notice) {
    setAppliedNotice(notice)
    setTitle(notice.title)
    setContent(notice.content)
    setAuthor(notice.author)
  }

  if (isEditMode && status === 'loading') {
    return <p className="admin-notice-form__status">불러오는 중입니다...</p>
  }

  if (isEditMode && status === 'not-found') {
    return (
      <div className="admin-notice-form__status" role="alert">
        <p>공지사항을 찾을 수 없습니다.</p>
        <Link className="admin-button" to="/admin/notices">목록으로</Link>
      </div>
    )
  }

  if (isEditMode && status === 'error') {
    return (
      <div className="admin-notice-form__status" role="alert">
        <p>공지사항을 불러오지 못했습니다.</p>
        <button type="button" className="admin-button admin-button--primary" onClick={retry}>
          {hasRetried ? '다시 시도 중...' : '다시 시도'}
        </button>
      </div>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle || !trimmedContent) {
      setSubmitError('제목과 내용을 모두 입력해 주세요.')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const payload = { title: trimmedTitle, content: trimmedContent, author: author.trim() }
      if (isEditMode) {
        await updateAdminNotice(noticeId, payload)
      } else {
        await createAdminNotice(payload)
      }
      navigate('/admin/notices', { state: { toast: isEditMode ? '공지사항을 수정했습니다.' : '공지사항을 등록했습니다.' } })
    } catch (error) {
      console.error('공지사항을 저장하지 못했습니다.', error)
      setSubmitError(error?.body?.message || '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-notice-form">
      <h1>{isEditMode ? '공지사항 수정' : '새 공지 작성'}</h1>

      <form onSubmit={handleSubmit}>
        <div className="admin-notice-form__field">
          <label htmlFor="notice-title">제목</label>
          <input id="notice-title" type="text" value={title} onChange={event => setTitle(event.target.value)} required />
        </div>

        <div className="admin-notice-form__field">
          <label htmlFor="notice-author">작성자</label>
          <input id="notice-author" type="text" value={author} onChange={event => setAuthor(event.target.value)} />
        </div>

        <div className="admin-notice-form__field">
          <label htmlFor="notice-content">내용</label>
          <textarea id="notice-content" rows={12} value={content} onChange={event => setContent(event.target.value)} required />
        </div>

        {submitError && <p className="admin-notice-form__error" role="alert">{submitError}</p>}

        <div className="admin-notice-form__actions">
          <Link className="admin-button" to="/admin/notices">취소</Link>
          <button type="submit" className="admin-button admin-button--primary" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
