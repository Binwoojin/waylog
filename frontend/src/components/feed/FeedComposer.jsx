import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { createFeedPost } from '../../api/feedApi'
import TourReferencePicker from '../common/TourReferencePicker'
import CourseReferencePicker from '../common/CourseReferencePicker'
import FeedImageEditor from './FeedImageEditor'
import PlacePinIcon from '../icons/PlacePinIcon'
import CourseRouteIcon from '../icons/CourseRouteIcon'
import './FeedComposer.css'

const MAX_IMAGE_COUNT = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_CONTENT_LENGTH = 2000
const MAX_TAG_COUNT = 10

/**
 * 피드 게시물 작성 모달
 *
 * Design Ref: feed-integration.design.md §5, §6 — 위치 태깅은 TourReferencePicker(여행지 검색)와
 * 자유 텍스트 입력을 함께 제공하고(Q-4), 이미지는 미리보기 + 드래그/버튼 순서변경을 제공한다(Q-5).
 * 클라이언트 검증 값(개수·용량·형식·글자수)은 FeedService.validateImages/FeedCreateRequest의
 * 서버 제한과 동일하게 맞춰, 실패를 업로드 전에 조기에 알린다.
 *
 * Design Ref: tour-course-feed-linking.design.md §6.2~§6.3 — 여행코스 태그(courseTag)는
 * 위치 태그(locationTag, TourAPI 좌표)와 완전히 독립된 필드다. "어디서 찍은 사진인가"와
 * "어느 여행코스를 참고했는가"는 서로 다른 질문이라 상호 배타로 두지 않는다 — 한 게시물이
 * 둘 다, 하나만, 혹은 둘 다 없이 작성될 수 있다.
 */
export default function FeedComposer({ open, onClose, onCreated }) {
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState([])
  const [locationTag, setLocationTag] = useState(null)
  const [showCustomLocationForm, setShowCustomLocationForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customAddress, setCustomAddress] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [courseTag, setCourseTag] = useState(null)
  const [coursePickerOpen, setCoursePickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const titleId = useId()
  const contentRef = useRef(null)
  const imageIdRef = useRef(0)
  const imagesRef = useRef(images)

  useEffect(() => {
    if (open) contentRef.current?.focus()
  }, [open])

  // 언마운트 시 정리용 effect(아래)가 항상 최신 images를 읽을 수 있도록, 렌더 중이 아니라
  // 커밋 이후(effect)에 ref를 갱신한다(react-hooks/refs: 렌더 중 ref 쓰기 금지).
  useEffect(() => {
    imagesRef.current = images
  }, [images])

  // 언마운트 시 그때까지 남아 있는 모든 미리보기 URL을 정리한다(개별 삭제 시에는 removeImage가 즉시 정리).
  useEffect(() => () => {
    imagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl))
  }, [])

  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !pickerOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, pickerOpen, onClose])

  if (!open) return null

  function addFiles(fileList) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return

    let remainingSlots = MAX_IMAGE_COUNT - images.length
    const accepted = []
    let firstError = ''

    for (const file of files) {
      if (remainingSlots <= 0) {
        firstError = firstError || `사진은 최대 ${MAX_IMAGE_COUNT}장까지 등록할 수 있습니다.`
        break
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        firstError = firstError || 'JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.'
        continue
      }
      if (file.size > MAX_IMAGE_SIZE) {
        firstError = firstError || '이미지 한 장은 5MB 이하만 업로드할 수 있습니다.'
        continue
      }
      imageIdRef.current += 1
      accepted.push({ localId: `img-${imageIdRef.current}`, file, previewUrl: URL.createObjectURL(file) })
      remainingSlots -= 1
    }

    if (accepted.length > 0) setImages(previous => [...previous, ...accepted])
    setErrorMessage(firstError)
  }

  function removeImage(localId) {
    setImages(previous => {
      const target = previous.find(image => image.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return previous.filter(image => image.localId !== localId)
    })
  }

  function addTagFromInput() {
    const raw = tagInput.trim().replace(/^#+/, '')
    if (!raw) return
    if (tags.length >= MAX_TAG_COUNT) {
      setErrorMessage(`해시태그는 최대 ${MAX_TAG_COUNT}개까지 등록할 수 있습니다.`)
      return
    }
    if (tags.includes(raw)) {
      setTagInput('')
      return
    }
    setTags(previous => [...previous, raw])
    setTagInput('')
  }

  function handleTagKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTagFromInput()
    }
  }

  function removeTag(tag) {
    setTags(previous => previous.filter(item => item !== tag))
  }

  function handlePickerSelect(picked) {
    setLocationTag({
      tourContentId: picked.tourContentId ?? null,
      tourContentTypeId: picked.tourContentTypeId ?? null,
      name: picked.name,
      address: picked.address ?? null,
      latitude: typeof picked.latitude === 'number' ? picked.latitude : null,
      longitude: typeof picked.longitude === 'number' ? picked.longitude : null,
    })
    setPickerOpen(false)
    setShowCustomLocationForm(false)
  }

  function confirmCustomLocation() {
    const trimmedName = customName.trim()
    if (!trimmedName) return
    setLocationTag({
      tourContentId: null,
      tourContentTypeId: null,
      name: trimmedName,
      address: customAddress.trim() || null,
      latitude: null,
      longitude: null,
    })
    setShowCustomLocationForm(false)
    setCustomName('')
    setCustomAddress('')
  }

  function clearLocationTag() {
    setLocationTag(null)
  }

  function handleCoursePickerSelect(picked) {
    setCourseTag(picked)
    setCoursePickerOpen(false)
  }

  function clearCourseTag() {
    setCourseTag(null)
  }

  function resetForm() {
    imagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl))
    setContent('')
    setVisibility('PUBLIC')
    setTags([])
    setTagInput('')
    setImages([])
    setLocationTag(null)
    setShowCustomLocationForm(false)
    setCustomName('')
    setCustomAddress('')
    setCourseTag(null)
    setErrorMessage('')
  }

  function handleClose() {
    if (submitting) return
    resetForm()
    onClose()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      setErrorMessage('내용을 입력해 주세요.')
      return
    }
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      setErrorMessage(`게시글은 ${MAX_CONTENT_LENGTH}자 이내로 입력해 주세요.`)
      return
    }

    setSubmitting(true)
    try {
      const created = await createFeedPost({
        content: trimmedContent,
        locationName: locationTag?.name ?? null,
        address: locationTag?.address ?? null,
        latitude: locationTag?.latitude ?? null,
        longitude: locationTag?.longitude ?? null,
        tourContentId: locationTag?.tourContentId ?? null,
        tourContentTypeId: locationTag?.tourContentTypeId ?? null,
        linkedCourseDayId: courseTag?.dayId ?? null,
        linkedCourseStopId: courseTag?.stopId ?? null,
        visibility,
        tags,
        images,
      })
      resetForm()
      onCreated(created)
    } catch (error) {
      console.error('게시물 작성에 실패했습니다.', error)
      setErrorMessage(error instanceof ApiError ? error.message : '게시물을 작성하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="feed-composer__overlay" onClick={handleClose}>
      <section
        className="feed-composer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <header className="feed-composer__header">
          <h2 id={titleId}>여행 이야기 작성</h2>
          <button type="button" className="feed-composer__close" aria-label="닫기" onClick={handleClose} disabled={submitting}>
            ✕
          </button>
        </header>

        <form className="feed-composer__form" onSubmit={handleSubmit}>
          <textarea
            ref={contentRef}
            className="feed-composer__textarea"
            placeholder="이번 여행은 어땠나요?"
            value={content}
            maxLength={MAX_CONTENT_LENGTH}
            onChange={event => setContent(event.target.value)}
            rows={6}
          />
          <p className="feed-composer__char-count">{content.length} / {MAX_CONTENT_LENGTH}</p>

          <div className="feed-composer__field">
            <p className="feed-composer__label">사진(선택, 최대 {MAX_IMAGE_COUNT}장)</p>
            <FeedImageEditor images={images} onReorder={setImages} onRemove={removeImage} />
            {images.length < MAX_IMAGE_COUNT && (
              <label className="feed-composer__upload">
                사진 추가
                <input
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  multiple
                  onChange={event => {
                    addFiles(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
            )}
          </div>

          <div className="feed-composer__field">
            <p className="feed-composer__label">위치 태그(선택)</p>
            {locationTag ? (
              <div className="feed-composer__location-chip">
                <PlacePinIcon size={16} />
                <span>{locationTag.name}</span>
                <button type="button" onClick={clearLocationTag} aria-label="위치 태그 삭제">✕</button>
              </div>
            ) : (
              <div className="feed-composer__location-actions">
                <button type="button" onClick={() => setPickerOpen(true)}>여행지에서 검색</button>
                <button
                  type="button"
                  onClick={() => setShowCustomLocationForm(value => !value)}
                  aria-expanded={showCustomLocationForm}
                >
                  직접 입력
                </button>
              </div>
            )}

            {showCustomLocationForm && !locationTag && (
              <div className="feed-composer__location-custom">
                <input
                  type="text"
                  placeholder="장소 이름"
                  value={customName}
                  onChange={event => setCustomName(event.target.value)}
                />
                <input
                  type="text"
                  placeholder="주소(선택)"
                  value={customAddress}
                  onChange={event => setCustomAddress(event.target.value)}
                />
                <button type="button" onClick={confirmCustomLocation} disabled={!customName.trim()}>
                  태그 추가
                </button>
              </div>
            )}
          </div>

          <div className="feed-composer__field">
            <p className="feed-composer__label">여행코스 태그(선택)</p>
            {courseTag ? (
              <div className="feed-composer__location-chip">
                <CourseRouteIcon size={16} />
                <span>
                  {courseTag.courseTitle} · {courseTag.dayNumber}일차
                  {courseTag.stopName ? ` · ${courseTag.stopName}` : ''}
                </span>
                <button type="button" onClick={clearCourseTag} aria-label="여행코스 태그 삭제">✕</button>
              </div>
            ) : (
              <div className="feed-composer__location-actions">
                <button type="button" onClick={() => setCoursePickerOpen(true)}>여행코스에서 선택</button>
              </div>
            )}
          </div>

          <div className="feed-composer__field">
            <p className="feed-composer__label">해시태그(선택, 최대 {MAX_TAG_COUNT}개)</p>
            <div className="feed-composer__tags">
              {tags.map(tag => (
                <span key={tag} className="feed-composer__tag">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`${tag} 태그 삭제`}>✕</button>
                </span>
              ))}
              <input
                type="text"
                className="feed-composer__tag-input"
                placeholder="태그 입력 후 Enter"
                value={tagInput}
                onChange={event => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTagFromInput}
              />
            </div>
          </div>

          <div className="feed-composer__field">
            <p className="feed-composer__label">공개 범위</p>
            <div className="feed-composer__visibility">
              <label>
                <input
                  type="radio"
                  name="feed-visibility"
                  value="PUBLIC"
                  checked={visibility === 'PUBLIC'}
                  onChange={() => setVisibility('PUBLIC')}
                />
                전체 공개
              </label>
              <label>
                <input
                  type="radio"
                  name="feed-visibility"
                  value="PRIVATE"
                  checked={visibility === 'PRIVATE'}
                  onChange={() => setVisibility('PRIVATE')}
                />
                나만 보기
              </label>
            </div>
          </div>

          {errorMessage && <p className="feed-composer__error" role="alert">{errorMessage}</p>}

          <div className="feed-composer__actions">
            <button type="button" className="feed-composer__button" onClick={handleClose} disabled={submitting}>
              취소
            </button>
            <button type="submit" className="feed-composer__button feed-composer__button--primary" disabled={submitting}>
              {submitting ? '게시 중...' : '게시하기'}
            </button>
          </div>
        </form>
      </section>

      {pickerOpen && (
        <TourReferencePicker
          open={pickerOpen}
          onCancel={() => setPickerOpen(false)}
          onSelect={handlePickerSelect}
        />
      )}

      {coursePickerOpen && (
        <CourseReferencePicker
          open={coursePickerOpen}
          onCancel={() => setCoursePickerOpen(false)}
          onSelect={handleCoursePickerSelect}
        />
      )}
    </div>
  )
}
