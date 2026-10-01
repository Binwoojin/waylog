import { useEffect, useRef, useState } from 'react'
import defaultAvatar from '../../assets/figma/destination-jeju.png'
import './ProfileSection.css'

const INTRODUCE_MAX_LENGTH = 200
const NICKNAME_MIN_LENGTH = 2
const NICKNAME_MAX_LENGTH = 30

function toFormValues(profile) {
  return {
    nickname: profile?.nickname ?? '',
    introduce: profile?.introduce ?? '',
    feedHandle: profile?.feedHandle ?? '',
  }
}

/**
 * 마이페이지 프로필 섹션 — 보기/수정 모드를 토글하는 단일 컴포넌트
 *
 * Design Ref: mypage-bookmarks.design.md §5.1, §5.2 — FeedUserProfilePage의 레이아웃(아바타·닉네임·
 * @핸들·통계)을 재사용하되, 수정 모드를 추가한다. 별도 라우트로 분리하지 않는다(화면 하나로 충분히 단순함).
 *
 * 이미지 교체는 "저장" 클릭 시 텍스트 필드와 함께 한 번에 전송한다(Q-3, 피드 작성 폼과 동일한 패턴).
 * 미리보기는 URL.createObjectURL로 만들고, 취소·재선택·언마운트 시 revokeObjectURL로 정리한다.
 */
export default function ProfileSection({ profile, isSaving, saveError, onSave }) {
  const [mode, setMode] = useState('view')
  const [form, setForm] = useState(() => toFormValues(profile))
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)

  // 보기 모드는 form이 아니라 profile을 직접 읽어 렌더링하므로(아래 JSX 참고), form을 효과에서
  // 다시 맞출 필요가 없다 — enterEditMode()가 수정 모드 진입 시점에 이미 최신 profile로 초기화한다.

  // 언마운트 시 미리보기 objectURL을 정리해 메모리 누수를 막는다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function enterEditMode() {
    setForm(toFormValues(profile))
    setMode('edit')
  }

  function cancelEdit() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setImageFile(null)
    setForm(toFormValues(profile))
    setMode('view')
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nickname = form.nickname.trim()
    if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
      return
    }

    const succeeded = await onSave({
      nickname,
      introduce: form.introduce.trim(),
      feedHandle: form.feedHandle.trim(),
      profileImageFile: imageFile,
    })

    if (succeeded) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setImageFile(null)
      setMode('view')
    }
  }

  const avatarSrc = previewUrl ?? profile.profileImageUrl ?? defaultAvatar
  const nicknameInvalid = form.nickname.trim().length > 0
    && (form.nickname.trim().length < NICKNAME_MIN_LENGTH || form.nickname.trim().length > NICKNAME_MAX_LENGTH)

  if (mode === 'view') {
    return (
      <section className="profile-section" aria-label="내 프로필">
        <img className="profile-section__avatar" src={avatarSrc} alt="" />
        <div className="profile-section__info">
          <h1>{profile.nickname}</h1>
          {profile.feedHandle && <p className="profile-section__handle">@{profile.feedHandle}</p>}
          {profile.introduce && <p className="profile-section__introduce">{profile.introduce}</p>}
          <dl className="profile-section__stats">
            <div>
              <dt>게시물</dt>
              <dd>{profile.postCount}</dd>
            </div>
            <div>
              <dt>받은 좋아요</dt>
              <dd>{profile.receiveLikeCount}</dd>
            </div>
          </dl>
        </div>
        <button type="button" className="profile-section__edit-button" onClick={enterEditMode}>
          프로필 수정
        </button>
      </section>
    )
  }

  return (
    <section className="profile-section profile-section--edit" aria-label="프로필 수정">
      <form onSubmit={handleSubmit}>
        <div className="profile-section__edit-avatar-row">
          <img className="profile-section__avatar" src={avatarSrc} alt="" />
          <div>
            <button type="button" className="profile-section__image-button" onClick={() => fileInputRef.current?.click()}>
              사진 변경
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageChange}
            />
            <p className="profile-section__image-hint">저장을 눌러야 실제로 반영됩니다.</p>
          </div>
        </div>

        <label className="profile-section__field">
          <span>닉네임</span>
          <input
            type="text"
            value={form.nickname}
            onChange={event => setForm(current => ({ ...current, nickname: event.target.value }))}
            maxLength={NICKNAME_MAX_LENGTH}
            required
          />
          {nicknameInvalid && (
            <small className="profile-section__error">닉네임은 {NICKNAME_MIN_LENGTH}~{NICKNAME_MAX_LENGTH}자로 입력해 주세요.</small>
          )}
        </label>

        <label className="profile-section__field">
          <span>소개</span>
          <textarea
            value={form.introduce}
            onChange={event => setForm(current => ({ ...current, introduce: event.target.value.slice(0, INTRODUCE_MAX_LENGTH) }))}
            maxLength={INTRODUCE_MAX_LENGTH}
            rows={3}
            placeholder="나를 소개하는 한마디를 남겨 보세요."
          />
          <small>{form.introduce.length} / {INTRODUCE_MAX_LENGTH}</small>
        </label>

        <label className="profile-section__field">
          <span>피드 아이디</span>
          <div className="profile-section__handle-field">
            <span aria-hidden="true">@</span>
            <input
              type="text"
              value={form.feedHandle}
              onChange={event => setForm(current => ({ ...current, feedHandle: event.target.value.replace(/^@+/, '') }))}
              maxLength={20}
              required
            />
          </div>
        </label>

        {saveError && <p className="profile-section__error profile-section__error--form" role="alert">{saveError}</p>}

        <div className="profile-section__actions">
          <button type="button" onClick={cancelEdit} disabled={isSaving}>취소</button>
          <button type="submit" className="profile-section__save-button" disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </section>
  )
}
