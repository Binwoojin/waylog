import { Link } from 'react-router-dom'
import fallbackImage from '../../assets/figma/destination-jeju.png'
import PlacePinIcon from '../icons/PlacePinIcon'
import { DESTINATION_CONTENT_TYPES, getTourDetailPath } from '../../data/tourContentTypes'
import './HomeSections.css'

/**
 * 상위 HomePage가 조회한 추천 여행지를 props로 받아 표시합니다.
 */

export default function RecommendedDestinationSection({
  destinations = [],
  isLoading,
  errorMessage,
}) {

  
  // 위치 아이콘, 주소, 설명을 포함한 3개의 대표 여행지 카드를 렌더링합니다.
  return <section id="destinations" className="home-section">
    <div className="section-heading">
      <div>
        <h2>추천 여행지</h2>
        <p>국내의 다양한 관광지와 문화 시설을 만나보세요.</p>
      </div>
      
      <Link to="/destinations/attractions">여행지 더보기 <span>→</span></Link>
    </div>

    {isLoading && (
      <p className="home-section__status">추천 여행지를 불러오는 중입니다.</p>
    )}

    {!isLoading && errorMessage && (
      <p className="home-section__status home-section__status--error">{errorMessage}</p>
    )}

    {!isLoading && !errorMessage && destinations.length === 0 && (
      <p className="home-section__status">현재 표시할 추천 여행지가 없습니다.</p>
    )}

    {!isLoading && !errorMessage && destinations.length > 0 && (
    <div className="destination-grid">
      {destinations.map((item) => (
        <article className="destination-card" key={item.contentId}>
          {/*
              Design Ref: §5.3 D-3 — 상세 API(detailCommon2)와 연결된 여행지 상세로 이동합니다.
              추천 여행지는 관광지(12)가 기본이므로 contentTypeId가 없으면 12로 봅니다.
              contentId 형식이 맞지 않으면 관광지 목록으로 보냅니다.
            */}
          <Link to={getTourDetailPath(item.contentId, item.contentTypeId ?? DESTINATION_CONTENT_TYPES.attraction) ?? '/destinations/attractions'}>
            <img src={item.image || item.thumbnail || fallbackImage} alt={item.title} />
            <div className="destination-card__body">
              <h3>{item.title}</h3>
              <p className="card-location"><PlacePinIcon />{item.address || '주소 정보 없음'}</p>
            </div>
          </Link>
        </article>
      ))}
      </div>
    )}
  </section>
}
