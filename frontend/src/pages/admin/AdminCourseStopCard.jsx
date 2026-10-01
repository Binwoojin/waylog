/**
 * 경유지 한 장(2단계 참조/직접입력 + 3단계 이미지)을 그리는 프레젠테이션 컴포넌트.
 *
 * Design Ref: 코드 리뷰 후속 과제 — AdminCourseFormPage.jsx가 약 660줄로 길어지면서, 이미
 * 화면에 드러나는 UX 경계(일자 카드 → 경유지 카드)를 기준으로 분리했다. 상태(course, 각종
 * 모달 target 등)와 저장/업로드 로직은 전부 AdminCourseForm(상위)에 그대로 남아 있고, 이
 * 컴포넌트는 그 상태의 "이번 경유지" 부분만 props로 받아 그리며, 사용자가 뭔가를 바꾸면
 * 콜백(onXxx)만 호출한다 — 상위 컴포넌트를 거치지 않고 직접 state를 건드리지 않는다.
 */
export default function AdminCourseStopCard({
  dayLocalKey,
  dayIndex,
  stop,
  stopIndex,
  isFirstStop,
  isLastStop,
  isSaved,
  dayImageCount,
  maxImagesPerDay,
  uploadingStopKey,
  onMoveStop,
  onRequestRemoveStop,
  onSetStopType,
  onUpdateStopField,
  onPickReference,
  onUploadImages,
  onRequestRemoveImage,
}) {
  return (
    <div className="admin-course-stop">
      <div className="admin-course-stop__header">
        <span className="admin-course-stop__index">{stopIndex + 1}</span>
        <div className="admin-course-stop__type">
          <label>
            <input
              type="radio"
              name={`stop-type-${dayLocalKey}-${stop.localKey}`}
              checked={stop.stopType === 'REFERENCE'}
              onChange={() => onSetStopType(dayIndex, stopIndex, 'REFERENCE')}
            />
            카탈로그 참조
          </label>
          <label>
            <input
              type="radio"
              name={`stop-type-${dayLocalKey}-${stop.localKey}`}
              checked={stop.stopType === 'CUSTOM'}
              onChange={() => onSetStopType(dayIndex, stopIndex, 'CUSTOM')}
            />
            직접 입력
          </label>
        </div>
        <div className="admin-course-stop__header-actions">
          <button type="button" className="admin-button" disabled={isFirstStop} onClick={() => onMoveStop(dayIndex, stopIndex, -1)}>▲</button>
          <button type="button" className="admin-button" disabled={isLastStop} onClick={() => onMoveStop(dayIndex, stopIndex, 1)}>▼</button>
          <button type="button" className="admin-button admin-button--danger" onClick={() => onRequestRemoveStop(dayIndex, stopIndex)}>삭제</button>
        </div>
      </div>

      {stop.stopType === 'REFERENCE' ? (
        <div className="admin-course-stop__reference">
          {stop.tourContentId ? (
            <p>
              <strong>{stop.name || '(이름 없음)'}</strong>
              {stop.address ? ` · ${stop.address}` : ''}
            </p>
          ) : (
            <p className="admin-course-stop__reference-empty">아직 선택된 여행지가 없습니다.</p>
          )}
          <button
            type="button"
            className="admin-button"
            onClick={() => onPickReference(dayIndex, stopIndex)}
          >
            카탈로그에서 선택
          </button>
        </div>
      ) : (
        <div className="admin-course-stop__custom">
          <div className="admin-course-form__field">
            <label htmlFor={`stop-name-${stop.localKey}`}>경유지 이름</label>
            <input
              id={`stop-name-${stop.localKey}`}
              type="text"
              value={stop.name}
              onChange={event => onUpdateStopField(dayIndex, stopIndex, 'name', event.target.value)}
            />
          </div>
          <div className="admin-course-form__field">
            <label htmlFor={`stop-address-${stop.localKey}`}>주소</label>
            <input
              id={`stop-address-${stop.localKey}`}
              type="text"
              value={stop.address}
              onChange={event => onUpdateStopField(dayIndex, stopIndex, 'address', event.target.value)}
            />
          </div>
          <div className="admin-course-stop__coords">
            <div className="admin-course-form__field">
              <label htmlFor={`stop-lat-${stop.localKey}`}>위도</label>
              <input
                id={`stop-lat-${stop.localKey}`}
                type="number"
                step="any"
                value={stop.latitude}
                onChange={event => onUpdateStopField(dayIndex, stopIndex, 'latitude', event.target.value)}
              />
            </div>
            <div className="admin-course-form__field">
              <label htmlFor={`stop-lng-${stop.localKey}`}>경도</label>
              <input
                id={`stop-lng-${stop.localKey}`}
                type="number"
                step="any"
                value={stop.longitude}
                onChange={event => onUpdateStopField(dayIndex, stopIndex, 'longitude', event.target.value)}
              />
            </div>
          </div>
          <p className="admin-course-stop__hint">좌표를 몰라도 주소만 입력해도 됩니다.</p>
        </div>
      )}

      {/* 3단계: 이미지 (저장 후에만 활성화) */}
      <div className="admin-course-stop__images">
        {!isSaved || !stop.id ? (
          <p className="admin-course-stop__images-locked">먼저 저장해야 이미지를 추가할 수 있습니다.</p>
        ) : (
          <>
            <div className="admin-course-stop__image-grid">
              {stop.images.map(image => (
                <div key={image.id} className="admin-course-stop__image">
                  <img src={image.url} alt="" />
                  <button
                    type="button"
                    className="admin-course-stop__image-remove"
                    aria-label="이미지 삭제"
                    onClick={() => onRequestRemoveImage({ stopId: stop.id, stopLocalKey: stop.localKey, image })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label
              className={`admin-button${dayImageCount >= maxImagesPerDay ? ' admin-button--disabled' : ''}`}
            >
              {uploadingStopKey === stop.localKey ? '업로드 중...' : '이미지 추가'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                disabled={dayImageCount >= maxImagesPerDay || uploadingStopKey === stop.localKey}
                onChange={event => {
                  onUploadImages(dayIndex, stopIndex, event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
            <span className={`admin-course-day__image-count${dayImageCount >= 8 ? ' is-warning' : ''}`}>
              이 일자 이미지 {dayImageCount}/{maxImagesPerDay}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
