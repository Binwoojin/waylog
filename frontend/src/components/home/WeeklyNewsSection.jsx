import { Link } from 'react-router-dom'
import fallbackImage from '../../assets/figma/news-busan.png'
import PlacePinIcon from '../icons/PlacePinIcon'
import './HomeSections.css'

/**
 * TourAPI의 YYYYMMDD 형식 날짜를
 * 화면에 표시할 YYYY.MM.DD 형식으로 변환합니다.
 *
 * 예:
 * 20260827 -> 2026.08.27
 *
 * 날짜가 없으면 null을 반환합니다.
 */
function formatFestivalDate(date) {
  if (!date) {
    return null
  }

  const dateText = String(date)

  /*
   * TourAPI 날짜가 YYYYMMDD 형식이 아닐 경우에는
   * 원래 값을 그대로 표시합니다.
   */

  if (dateText.length !== 8) {
    return dateText
  }

  return `${dateText.slice(0, 4)}.${dateText.slice(4, 6)}.${dateText.slice(6, 8)}`
}

/**
 * 축제 시작일과 종료일을 화면에 표시할 문자열로 만듭니다.
 *
 * 시작일과 종료일이 모두 있으면:
 * 2026.08.27 ~ 2026.08.30
 *
 * 시작일만 있으면:
 * 2026.08.27
 *
 * 날짜가 모두 없으면:
 * 행사 일정 확인
 */

function makeFestivalPeriod(startDate, endDate) {
  const formattedStartDate = formatFestivalDate(startDate)
  const formattedEndDate = formatFestivalDate(endDate)

  if (formattedStartDate && formattedEndDate) {
    return `${formattedStartDate} ~ ${formattedEndDate}`
  }

  if (formattedStartDate) {
    return formattedStartDate
  }

  if (formattedEndDate) {
    return formattedEndDate
  }
   /*
   * 현재 백엔드는 startDate와 endDate를 null로 반환하므로
   * 날짜 API를 추가하기 전까지 이 문구가 표시됩니다.
   */
  return '행사 일정 확인'
}

/**
 * 메인 화면의 '이번 주 여행 소식' 영역입니다.
 *
 * App.jsx에서 /api/home 응답의 festivals 목록과
 * 로딩 상태, 오류 메시지를 props로 전달받습니다.
 */
export default function WeeklyNewsSection({
  festivals = [],
  isLoading,
  errorMessage,
}) {
  return (
  <section className="home-section news-section">
    <div className="section-heading">
      <div>
        <h2>이번 주 여행 소식</h2>
        <p>현재 진행 중이거나 곧 시작하는 축제와 행사입니다.</p>
      </div>
      <Link to="/enjoy/festivals">행사 전체 보기 <span>→</span></Link>
    </div>
    {/* /api/home 요청이 진행 중일 때 표시합니다. */}
      {isLoading && (
        <p className="home-section__status">
          축제와 행사 정보를 불러오는 중입니다.
        </p>
      )}

      {/* /api/home 요청이 실패했을 때 표시합니다. */}
      {!isLoading && errorMessage && (
        <p className="home-section__status home-section__status--error">
          {errorMessage}
        </p>
      )}

      {/* 요청은 성공했지만 축제 목록이 비어 있을 때 표시합니다. */}
      {!isLoading &&
        !errorMessage &&
        festivals.length === 0 && (
          <p className="home-section__status">
            현재 표시할 축제와 행사가 없습니다.
          </p>
        )}

         {/* 조회된 축제 데이터가 있을 때 카드 목록을 표시합니다. */}
        {!isLoading && !errorMessage && festivals.length > 0 && (
          <div className="news-grid">
            {festivals.map((festival) => (
              <article className="news-card" key={festival.contentId}>
                {/*
                 * 상세 페이지 주소에는 제목 대신 contentId를 사용합니다.
                 * 제목은 중복되거나 URL에 공백과 특수문자가 포함될 수 있지만,
                 * contentId는 TourAPI 콘텐츠의 고유 식별자입니다.
                 */}
                <a href={`/enjoy/festivals/${festival.contentId}`}>
                  <img src={festival.image || fallbackImage} 
                  alt={festival.title} 
                  onError={(event) => {
                    /*
                       * 이미지 URL이 존재하지만 실제 로딩에 실패한 경우
                       * 프로젝트의 기본 이미지로 교체합니다.
                       */
                      event.currentTarget.onerror = null
                    event.currentTarget.src = fallbackImage
                  }}/>
                  <div className="news-card__body">
                    <span className="news-card__badge">행사</span>
                    <h3>{festival.title || ' 축제명 정보 없음'}</h3>
                    <p>◷{' '}
                      {makeFestivalPeriod(
                        festival.startDate,
                        festival.endDate,
                      )}</p>
                    <p className="location-with-pin">
                      <PlacePinIcon />
                      {festival.address || '장소 정보가 없습니다.'}
                    </p>
                  </div>
                </a>
              </article>
            ))}
          </div>
        )}
  </section>
  )
}
