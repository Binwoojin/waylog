import { Link, useParams } from 'react-router-dom'
import { useCourseDetail } from '../hooks/useCourseDetail'
import DetailStatus from '../components/detail/DetailStatus'
import NotFoundPage from './NotFoundPage'
import { DETAIL_NOT_FOUND_DESCRIPTION, DETAIL_NOT_FOUND_TITLE } from '../components/detail/detailMessages'
import { getTourDetailPath } from '../data/tourContentTypes'
import { formatCourseDuration } from '../api/courseApi'
import { buildKakaoMapLink } from '../lib/mapLink'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import defaultImage from '../assets/figma/destination-jeju.png'
import './TourCourseDetailPage.css'

const COURSE_LIST_PATH = '/destinations/courses'

/**
 * 여행코스 상세 (`/destinations/courses/:id`)
 *
 * Design Ref: tour-course-list-integration.design.md §6, §8 — 기존 `/destinations/detail/:id`와
 * 완전히 분리된 라우트입니다(Q-5, ID 네임스페이스 충돌 방지). 목업 전용이던 TravelCourseDetailPage.jsx를
 * 대체합니다. 로딩·오류·없음 화면은 TourApiDetail과 같은 공용 컴포넌트(DetailStatus, NotFoundPage)를 씁니다.
 */
export default function TourCourseDetailPage() {
  const { id } = useParams()
  // key={id}로 재마운트해 id가 바뀔 때 useCourseDetail이 항상 loading부터 시작합니다(§8.1).
  return <TourCourseDetailContent key={id} id={id} />
}

function TourCourseDetailContent({ id }) {
  const { status, detail, retry, hasRetried } = useCourseDetail(id)

  if (status === 'loading') return <DetailStatus variant="loading" />
  if (status === 'error') {
    return <DetailStatus variant="error" onRetry={retry} backTo={COURSE_LIST_PATH} focusOnMount={hasRetried} />
  }
  if (status === 'not-found') {
    return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
  }

  return <TourCourseDetailView detail={detail} />
}

function TourCourseDetailView({ detail }) {
  const stopCount = detail.days.reduce((sum, day) => sum + day.stops.length, 0)
  const duration = formatCourseDuration(detail.days.length)
  const coverImage = detail.coverImageUrl ?? defaultImage

  const goBack = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.href = COURSE_LIST_PATH
  }

  return (
    <div className="course-detail-page">
      <main className="course-detail-main">
        <button className="course-detail-back" type="button" onClick={goBack}>
          <span aria-hidden="true">←</span> 이전 페이지
        </button>
        <nav className="course-detail-crumb">
          <Link to="/">홈</Link><i>›</i>
          <Link to="/destinations">여행지</Link><i>›</i>
          <Link to={COURSE_LIST_PATH}>여행코스</Link><i>›</i>
          <strong>{detail.title}</strong>
        </nav>

        <header className="course-detail-hero">
          <img src={coverImage} alt={detail.title} />
          <div className="course-detail-hero__shade" />
          <div className="course-detail-hero__copy">
            {detail.theme && <span>{detail.theme}</span>}
            <h1>{detail.title}</h1>
          </div>
        </header>

        <section className="course-detail-stats">
          <div><small>여행 일정</small><strong>{duration}</strong></div>
          <div><small>코스 일자</small><strong>{detail.days.length}일</strong></div>
          <div><small>코스 지점</small><strong>{stopCount}곳</strong></div>
          <div><small>코스 테마</small><strong>{detail.theme ?? '지정 안 함'}</strong></div>
        </section>

        {detail.days.map(day => (
          <section className="course-detail-day" key={day.id ?? day.dayNumber}>
            <h2 className="course-detail-day__heading">{day.dayNumber}일차</h2>
            <div className="course-detail-stops">
              {day.stops.map(stop => (
                <CourseStopCard
                  key={stop.id ?? `${day.dayNumber}-${stop.sortOrder}`}
                  stop={stop}
                  order={stop.sortOrder + 1}
                />
              ))}
            </div>
          </section>
        ))}

        <p className="course-detail-source"><b>WayLog</b>가 등록한 여행코스입니다.</p>
      </main>
    </div>
  )
}

/**
 * 경유지 카드
 *
 * Design Ref: §5 — REFERENCE는 여행지 상세로 항상 링크(D-2), CUSTOM은 좌표가 있을 때만
 * 카카오맵 딥링크 버튼을 보여줍니다(D-1). 좌표가 없으면 버튼 자체를 렌더링하지 않습니다(거짓 UI 금지).
 */
function CourseStopCard({ stop, order }) {
  // getTourDetailPath가 null이면(이론상 발생하지 않음, §5.1) CUSTOM과 같은 텍스트 표시로 폴백합니다.
  const referencePath = stop.stopType === 'REFERENCE' ? getTourDetailPath(stop.tourContentId, stop.tourContentTypeId) : null
  const mapLink = stop.stopType === 'CUSTOM' ? buildKakaoMapLink(stop) : null
  const [firstImage, ...restImages] = stop.images

  return (
    <article className="course-detail-stop">
      {firstImage ? <img src={firstImage.url} alt="" /> : <div className="course-detail-stop__no-image" aria-hidden="true" />}
      <div className="course-detail-stop__body">
        <span className="course-detail-stop__order">STOP {String(order).padStart(2, '0')}</span>
        <h3>{stop.name}</h3>
        {stop.address && (
          <p className="course-detail-stop__address"><PlacePinIcon size={16} />{stop.address}</p>
        )}
        {(referencePath || mapLink) && (
          <div className="course-detail-stop__actions">
            {referencePath && <Link to={referencePath}>여행지 상세 보기</Link>}
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noopener noreferrer">지도에서 보기</a>
            )}
          </div>
        )}
        {restImages.length > 0 && (
          <div className="course-detail-stop__gallery">
            {restImages.map(image => <img key={image.id ?? image.url} src={image.url} alt="" />)}
          </div>
        )}
      </div>
    </article>
  )
}
