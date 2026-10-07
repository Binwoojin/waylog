import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAdminCourseDetail } from '../../hooks/useAdminCourseDetail'
import {
  addAdminCourseStopImages,
  createAdminCourse,
  deleteAdminCourseStopImage,
  replaceAdminCourseCoverImage,
  updateAdminCourse,
} from '../../api/adminCourseApi'
// Design Ref: feed-integration.design.md §5.2 — 공개 피드 작성 폼도 이 모달을 재사용하도록
// components/common/으로 이동했다(내부 로직·마크업은 변경 없음, 경로만 변경).
import TourReferencePicker from '../../components/common/TourReferencePicker'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AdminToast from '../../components/admin/AdminToast'
import AdminCourseDayCard from './AdminCourseDayCard'
import './AdminCourseFormPage.css'

const MAX_IMAGES_PER_DAY = 10

function createLocalKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Math.random().toString(36).slice(2)}`
}

function createEmptyStop() {
  return {
    localKey: createLocalKey(),
    id: null,
    stopType: 'CUSTOM',
    tourContentId: null,
    tourContentTypeId: null,
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    images: [],
  }
}

function createEmptyDay() {
  return { localKey: createLocalKey(), id: null, stops: [] }
}

/**
 * 서버 응답(TourCourseResponse view model)에서 특정 경유지의 최신 이미지 목록만 찾는다.
 *
 * Must Fix(코드 리뷰) — 이미지 API 응답은 구조 전체(TourCourseResponse)이지만, 여기엔
 * "아직 구조 저장을 누르지 않은 로컬 전용 일자/경유지"가 없다. 이 응답으로 course 상태
 * 전체를 교체하면(toFormCourse(saved)) 그런 미저장 편집이 조용히 사라진다. 그래서 응답에서
 * 이 경유지의 images 필드만 꺼내 로컬 트리에 머지한다(mergeStopImages).
 */
function findStopImages(savedCourse, stopId) {
  for (const day of savedCourse.days) {
    const stop = day.stops.find(candidate => candidate.id === stopId)
    if (stop) return stop.images
  }
  return []
}

/**
 * 로컬 트리에서 localKey로 경유지를 찾아 images만 교체한다. dayIndex·stopIndex가 아니라
 * localKey로 찾는 이유는, 업로드가 끝나기 전에 관리자가 일자·경유지 순서를 바꿔도
 * 엉뚱한 위치에 이미지가 반영되지 않게 하기 위해서다.
 */
function mergeStopImages(courseState, stopLocalKey, images) {
  return {
    ...courseState,
    days: courseState.days.map(day => ({
      ...day,
      stops: day.stops.map(stop => (stop.localKey === stopLocalKey ? { ...stop, images } : stop)),
    })),
  }
}

/**
 * API view model(adminCourseApi.js) → 폼 편집용 로컬 모델.
 *
 * Design Ref: admin-dashboard.design.md §3.3.4 — 일자·경유지에 React key로 쓸 localKey를
 * 붙인다. 서버 id가 있으면 그대로 문자열화해서 쓰고(같은 항목은 항상 같은 key), 아직
 * 저장되지 않은 새 항목은 이번 세션에서만 유효한 임시 key를 만든다.
 */
function toFormCourse(course) {
  if (!course) {
    return { id: null, title: '', theme: '', coverImageUrl: null, days: [] }
  }

  return {
    id: course.id,
    title: course.title,
    theme: course.theme,
    coverImageUrl: course.coverImageUrl,
    days: course.days.map(day => ({
      localKey: day.id != null ? String(day.id) : createLocalKey(),
      id: day.id,
      stops: day.stops.map(stop => ({
        localKey: stop.id != null ? String(stop.id) : createLocalKey(),
        id: stop.id,
        stopType: stop.stopType,
        tourContentId: stop.tourContentId,
        tourContentTypeId: stop.tourContentTypeId,
        name: stop.name,
        address: stop.address ?? '',
        latitude: stop.latitude ?? '',
        longitude: stop.longitude ?? '',
        images: stop.images,
      })),
    })),
  }
}

/**
 * 관리자 여행코스 작성/수정 화면
 *
 * Design Ref: admin-dashboard.design.md §5.3, §3.3.4, 계획 FR-C04~FR-C06
 * 라우트: /admin/courses/new(생성), /admin/courses/:id/edit(수정)
 *
 * 구조 조회는 useAdminNoticeDetail·useAdminUserDetail과 같은 패턴(URL의 id로 직접 조회,
 * 라우터 state 의존 없음)이다.
 */
export default function AdminCourseFormPage() {
  const { id } = useParams()
  const { status, course, retry, hasRetried } = useAdminCourseDetail(id)

  if (id && status === 'loading') {
    return <p className="admin-course-form__status">불러오는 중입니다...</p>
  }

  if (id && status === 'not-found') {
    return (
      <div className="admin-course-form__status">
        <p>여행코스를 찾을 수 없습니다.</p>
        <Link className="admin-button admin-button--primary" to="/admin/courses">목록으로</Link>
      </div>
    )
  }

  if (id && status === 'error') {
    return (
      <div className="admin-course-form__status" role="alert">
        <p>여행코스를 불러오지 못했습니다.</p>
        <button type="button" className="admin-button admin-button--primary" onClick={retry}>
          {hasRetried ? '다시 시도 중...' : '다시 시도'}
        </button>
      </div>
    )
  }

  // id가 바뀌면(다른 코스로 이동) 폼 상태를 완전히 새로 시작하도록 재마운트합니다.
  return <AdminCourseForm key={id ?? 'new'} initialCourse={course} />
}

function AdminCourseForm({ initialCourse }) {
  const navigate = useNavigate()

  const [course, setCourse] = useState(() => toFormCourse(initialCourse))
  const [isSavingStructure, setIsSavingStructure] = useState(false)
  const [structureError, setStructureError] = useState(null)
  const [toast, setToast] = useState(null)

  const [pickerTarget, setPickerTarget] = useState(null) // { dayIndex, stopIndex } | null
  const [removeTarget, setRemoveTarget] = useState(null) // { type: 'day'|'stop', dayIndex, stopIndex?, imageCount } | null
  const [removeImageTarget, setRemoveImageTarget] = useState(null) // { stopId, stopLocalKey, image } | null
  const [isRemovingImage, setIsRemovingImage] = useState(false)
  const [uploadingStopKey, setUploadingStopKey] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)

  // Design Ref: §3.3.4 — 코스가 저장되어 id를 받기 전까지는 이미지 첨부 UI 전체를 비활성화합니다.
  const isSaved = Boolean(course.id)

  function addDay() {
    setCourse(previous => ({ ...previous, days: [...previous.days, createEmptyDay()] }))
  }

  // Design Ref: 계획 요청("삭제는 항상 ConfirmDialog를 거치세요") — 이미지가 없어도 예외를 두지 않는다.
  function requestRemoveDay(dayIndex) {
    const day = course.days[dayIndex]
    const imageCount = day.stops.reduce((sum, stop) => sum + stop.images.length, 0)
    setRemoveTarget({ type: 'day', dayIndex, imageCount })
  }

  function removeDay(dayIndex) {
    setCourse(previous => ({ ...previous, days: previous.days.filter((_, index) => index !== dayIndex) }))
  }

  function moveDay(dayIndex, direction) {
    setCourse(previous => {
      const target = dayIndex + direction
      if (target < 0 || target >= previous.days.length) return previous
      const days = [...previous.days]
      ;[days[dayIndex], days[target]] = [days[target], days[dayIndex]]
      return { ...previous, days }
    })
  }

  function addStop(dayIndex) {
    setCourse(previous => {
      const days = previous.days.map((day, index) => (
        index === dayIndex ? { ...day, stops: [...day.stops, createEmptyStop()] } : day
      ))
      return { ...previous, days }
    })
  }

  function requestRemoveStop(dayIndex, stopIndex) {
    const stop = course.days[dayIndex].stops[stopIndex]
    setRemoveTarget({ type: 'stop', dayIndex, stopIndex, imageCount: stop.images.length })
  }

  function removeStop(dayIndex, stopIndex) {
    setCourse(previous => {
      const days = previous.days.map((day, index) => (
        index === dayIndex ? { ...day, stops: day.stops.filter((_, si) => si !== stopIndex) } : day
      ))
      return { ...previous, days }
    })
  }

  function moveStop(dayIndex, stopIndex, direction) {
    setCourse(previous => {
      const day = previous.days[dayIndex]
      const target = stopIndex + direction
      if (target < 0 || target >= day.stops.length) return previous
      const stops = [...day.stops]
      ;[stops[stopIndex], stops[target]] = [stops[target], stops[stopIndex]]
      const days = previous.days.map((d, index) => (index === dayIndex ? { ...d, stops } : d))
      return { ...previous, days }
    })
  }

  function updateStopField(dayIndex, stopIndex, field, value) {
    setCourse(previous => {
      const days = previous.days.map((day, di) => {
        if (di !== dayIndex) return day
        const stops = day.stops.map((stop, si) => (si === stopIndex ? { ...stop, [field]: value } : stop))
        return { ...day, stops }
      })
      return { ...previous, days }
    })
  }

  function setStopType(dayIndex, stopIndex, stopType) {
    setCourse(previous => {
      const days = previous.days.map((day, di) => {
        if (di !== dayIndex) return day
        const stops = day.stops.map((stop, si) => {
          if (si !== stopIndex) return stop
          if (stopType === 'CUSTOM') {
            return { ...stop, stopType, tourContentId: null, tourContentTypeId: null }
          }
          return { ...stop, stopType }
        })
        return { ...day, stops }
      })
      return { ...previous, days }
    })
  }

  function applyReference(picked) {
    if (!pickerTarget) return
    const { dayIndex, stopIndex } = pickerTarget

    setCourse(previous => {
      const days = previous.days.map((day, di) => {
        if (di !== dayIndex) return day
        const stops = day.stops.map((stop, si) => (si === stopIndex ? {
          ...stop,
          stopType: 'REFERENCE',
          tourContentId: picked.tourContentId,
          tourContentTypeId: picked.tourContentTypeId,
          name: picked.name,
          address: picked.address ?? '',
          latitude: picked.latitude ?? '',
          longitude: picked.longitude ?? '',
        } : stop))
        return { ...day, stops }
      })
      return { ...previous, days }
    })
    setPickerTarget(null)
  }

  function validate() {
    if (!course.title.trim()) return '코스명을 입력해 주세요.'
    if (course.days.length === 0) return '최소 하나 이상의 일자가 필요합니다.'

    for (let dayIndex = 0; dayIndex < course.days.length; dayIndex++) {
      const day = course.days[dayIndex]
      if (day.stops.length === 0) return `${dayIndex + 1}일차에는 최소 하나 이상의 경유지가 필요합니다.`

      for (const stop of day.stops) {
        if (!stop.name.trim()) return `${dayIndex + 1}일차 경유지 이름을 입력해 주세요.`
        if (stop.stopType === 'REFERENCE' && !stop.tourContentId) {
          return `${dayIndex + 1}일차의 참조 경유지는 카탈로그에서 여행지를 선택해야 합니다.`
        }
      }
    }

    return null
  }

  async function handleSaveStructure() {
    const validationError = validate()
    if (validationError) {
      setStructureError(validationError)
      return
    }

    setStructureError(null)
    setIsSavingStructure(true)
    try {
      const saved = isSaved
        ? await updateAdminCourse(course.id, course)
        : await createAdminCourse(course)

      setCourse(toFormCourse(saved))
      setToast(isSaved ? '코스 정보를 저장했습니다.' : '코스 정보를 저장했습니다. 이제 이미지를 추가할 수 있습니다.')

      if (!isSaved) {
        navigate(`/admin/courses/${saved.id}/edit`, { replace: true })
      }
    } catch (error) {
      console.error('여행코스를 저장하지 못했습니다.', error)
      setStructureError(error?.body?.message || '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingStructure(false)
    }
  }

  function pickReference(dayIndex, stopIndex) {
    setPickerTarget({ dayIndex, stopIndex })
  }

  async function handleUploadImages(dayIndex, stopIndex, fileList) {
    const files = Array.from(fileList ?? [])
    const stop = course.days[dayIndex].stops[stopIndex]
    if (!stop.id || !course.id || files.length === 0) return

    setUploadError(null)
    setUploadingStopKey(stop.localKey)
    try {
      const saved = await addAdminCourseStopImages(course.id, stop.id, files)
      const images = findStopImages(saved, stop.id)
      setCourse(previous => mergeStopImages(previous, stop.localKey, images))
    } catch (error) {
      console.error('이미지를 추가하지 못했습니다.', error)
      setUploadError(error?.body?.message || '이미지를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setUploadingStopKey(null)
    }
  }

  async function handleConfirmRemoveImage() {
    if (!removeImageTarget || !course.id) return

    setIsRemovingImage(true)
    try {
      const saved = await deleteAdminCourseStopImage(course.id, removeImageTarget.stopId, removeImageTarget.image.id)
      const images = findStopImages(saved, removeImageTarget.stopId)
      setCourse(previous => mergeStopImages(previous, removeImageTarget.stopLocalKey, images))
      setRemoveImageTarget(null)
    } catch (error) {
      console.error('이미지를 삭제하지 못했습니다.', error)
      window.alert(error?.body?.message || '이미지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsRemovingImage(false)
    }
  }

  async function handleUploadCover(file) {
    if (!course.id || !file) return

    setIsUploadingCover(true)
    try {
      const saved = await replaceAdminCourseCoverImage(course.id, file)
      // Must Fix — 대표 이미지도 coverImageUrl 필드만 갱신하고 나머지 로컬 편집 상태는 그대로 둔다.
      setCourse(previous => ({ ...previous, coverImageUrl: saved.coverImageUrl }))
      setToast('대표 이미지를 변경했습니다.')
    } catch (error) {
      console.error('대표 이미지를 변경하지 못했습니다.', error)
      window.alert(error?.body?.message || '대표 이미지를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUploadingCover(false)
    }
  }

  return (
    <div className="admin-course-form">
      <h1>{isSaved ? '여행코스 수정' : '새 여행코스 작성'}</h1>

      {/* 1단계: 코스 정보 */}
      <section className="admin-course-form__card">
        <h2>1단계 · 코스 정보</h2>
        <div className="admin-course-form__field">
          <label htmlFor="course-title">코스명</label>
          <input
            id="course-title"
            type="text"
            value={course.title}
            onChange={event => setCourse(previous => ({ ...previous, title: event.target.value }))}
          />
        </div>
        <div className="admin-course-form__field">
          <label htmlFor="course-theme">테마</label>
          <input
            id="course-theme"
            type="text"
            value={course.theme}
            placeholder="예: 가족여행, 미식 여행"
            onChange={event => setCourse(previous => ({ ...previous, theme: event.target.value }))}
          />
        </div>
      </section>

      {/* 2단계: 일자·경유지 */}
      <section className="admin-course-form__card">
        <h2>2단계 · 일자와 경유지</h2>

        {course.days.map((day, dayIndex) => (
          <AdminCourseDayCard
            key={day.localKey}
            day={day}
            dayIndex={dayIndex}
            isFirstDay={dayIndex === 0}
            isLastDay={dayIndex === course.days.length - 1}
            isSaved={isSaved}
            maxImagesPerDay={MAX_IMAGES_PER_DAY}
            uploadingStopKey={uploadingStopKey}
            onMoveDay={moveDay}
            onRequestRemoveDay={requestRemoveDay}
            onAddStop={addStop}
            onMoveStop={moveStop}
            onRequestRemoveStop={requestRemoveStop}
            onSetStopType={setStopType}
            onUpdateStopField={updateStopField}
            onPickReference={pickReference}
            onUploadImages={handleUploadImages}
            onRequestRemoveImage={setRemoveImageTarget}
          />
        ))}

        {uploadError && <p className="admin-course-form__error" role="alert">{uploadError}</p>}

        <button type="button" className="admin-button" onClick={addDay}>일자 추가</button>
      </section>

      {structureError && <p className="admin-course-form__error" role="alert">{structureError}</p>}

      <div className="admin-course-form__actions">
        <Link className="admin-button" to="/admin/courses">취소</Link>
        <button type="button" className="admin-button admin-button--primary" disabled={isSavingStructure} onClick={handleSaveStructure}>
          {isSavingStructure ? '저장 중...' : '구조 저장'}
        </button>
      </div>

      {/* 대표 이미지 (저장 후에만 활성화, 일자 이미지 제한과 무관) */}
      <section className="admin-course-form__card">
        <h2>대표 이미지</h2>
        {!isSaved ? (
          <p className="admin-course-stop__images-locked">먼저 저장해야 대표 이미지를 추가할 수 있습니다.</p>
        ) : (
          <div className="admin-course-form__cover">
            {course.coverImageUrl
              ? <img className="admin-course-form__cover-preview" src={course.coverImageUrl} alt="" />
              : <span className="admin-course-form__cover-preview admin-course-form__cover-preview--empty" aria-hidden="true" />}
            <label className="admin-button">
              {isUploadingCover ? '업로드 중...' : '대표 이미지 변경'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={isUploadingCover}
                onChange={event => {
                  const [file] = event.target.files
                  handleUploadCover(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
        )}
      </section>

      {/*
        pickerTarget이 없을 때는 아예 마운트하지 않습니다. TourReferencePicker는 열리자마자
        지역 목록을 조회하므로(useRegions), 늘 마운트해 두면 경유지를 한 번도 고르지 않는
        코스 편집 세션에서도 불필요한 요청이 나갑니다.
      */}
      {pickerTarget && (
        <TourReferencePicker
          open
          onCancel={() => setPickerTarget(null)}
          onSelect={applyReference}
        />
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={removeTarget?.type === 'day' ? '일자를 삭제할까요?' : '경유지를 삭제할까요?'}
        description={removeTarget ? (
          removeTarget.imageCount > 0
            ? `이미지 ${removeTarget.imageCount}장이 함께 있습니다. "구조 저장"을 누르면 이 이미지들도 영구적으로 삭제됩니다.`
            : '"구조 저장"을 눌러야 실제로 반영됩니다.'
        ) : undefined}
        confirmLabel="삭제"
        onConfirm={() => {
          if (removeTarget?.type === 'day') removeDay(removeTarget.dayIndex)
          else if (removeTarget) removeStop(removeTarget.dayIndex, removeTarget.stopIndex)
          setRemoveTarget(null)
        }}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeImageTarget)}
        title="이미지를 삭제할까요?"
        description="삭제하면 되돌릴 수 없습니다."
        confirmLabel="삭제"
        pending={isRemovingImage}
        onConfirm={handleConfirmRemoveImage}
        onCancel={() => setRemoveImageTarget(null)}
      />

      <AdminToast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
