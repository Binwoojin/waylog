import AdminCourseStopCard from './AdminCourseStopCard'

/**
 * 일자 한 장(헤더 + 경유지 목록)을 그리는 프레젠테이션 컴포넌트.
 *
 * Design Ref: 코드 리뷰 후속 과제 — AdminCourseFormPage.jsx 2단계(일자·경유지) 영역을
 * 분리했다. 이 컴포넌트도 AdminCourseStopCard와 마찬가지로 상태를 들고 있지 않고, 상위
 * (AdminCourseForm)가 넘긴 콜백만 그대로 AdminCourseStopCard에 전달한다. 일자당 이미지 총합
 * (dayImageCount)은 day.stops에서 파생되는 값이라 상위에서 다시 계산해 내려줄 필요 없이
 * 여기서 직접 구한다.
 */
export default function AdminCourseDayCard({
  day,
  dayIndex,
  isFirstDay,
  isLastDay,
  isSaved,
  maxImagesPerDay,
  uploadingStopKey,
  onMoveDay,
  onRequestRemoveDay,
  onAddStop,
  onMoveStop,
  onRequestRemoveStop,
  onSetStopType,
  onUpdateStopField,
  onPickReference,
  onUploadImages,
  onRequestRemoveImage,
}) {
  const dayImageCount = day.stops.reduce((sum, stop) => sum + stop.images.length, 0)

  return (
    <div className="admin-course-day">
      <div className="admin-course-day__header">
        <h3>{dayIndex + 1}일차</h3>
        <div className="admin-course-day__header-actions">
          <button type="button" className="admin-button" disabled={isFirstDay} onClick={() => onMoveDay(dayIndex, -1)}>▲</button>
          <button type="button" className="admin-button" disabled={isLastDay} onClick={() => onMoveDay(dayIndex, 1)}>▼</button>
          <button type="button" className="admin-button admin-button--danger" onClick={() => onRequestRemoveDay(dayIndex)}>일자 삭제</button>
        </div>
      </div>

      {day.stops.length === 0 && <p className="admin-course-day__empty">경유지가 없습니다. 아래 버튼으로 추가해 주세요.</p>}

      {day.stops.map((stop, stopIndex) => (
        <AdminCourseStopCard
          key={stop.localKey}
          dayLocalKey={day.localKey}
          dayIndex={dayIndex}
          stop={stop}
          stopIndex={stopIndex}
          isFirstStop={stopIndex === 0}
          isLastStop={stopIndex === day.stops.length - 1}
          isSaved={isSaved}
          dayImageCount={dayImageCount}
          maxImagesPerDay={maxImagesPerDay}
          uploadingStopKey={uploadingStopKey}
          onMoveStop={onMoveStop}
          onRequestRemoveStop={onRequestRemoveStop}
          onSetStopType={onSetStopType}
          onUpdateStopField={onUpdateStopField}
          onPickReference={onPickReference}
          onUploadImages={onUploadImages}
          onRequestRemoveImage={onRequestRemoveImage}
        />
      ))}

      <button type="button" className="admin-button" onClick={() => onAddStop(dayIndex)}>경유지 추가</button>
    </div>
  )
}
