import { useState } from 'react'
import { Link } from 'react-router-dom'
import festival from '../../assets/figma/enjoy-festival.png'
import leports from '../../assets/figma/enjoy-leports.png'
import food from '../../assets/figma/enjoy-food.png'
import shopping from '../../assets/figma/enjoy-shopping.png'
import stay from '../../assets/figma/enjoy-stay.png'
import PlacePinIcon from '../icons/PlacePinIcon'
import './HomeSections.css'

/**
 * 화면 필터에 표시할 카테고리입니다.
 *
 * 백엔드의 TourEnjoyResponse.category 값과
 * 문자열이 정확히 일치해야 합니다.
 */
const filters = ['전체', '축제·행사', '레포츠', '음식점', '쇼핑', '숙박']

/**
 * TourAPI가 대표 이미지를 제공하지 않을 때 사용할
 * 카테고리별 로컬 fallback 이미지입니다.
 */
const fallbackImages = {
  '축제·행사': festival,
  '레포츠': leports,
  '음식점': food,
  '쇼핑': shopping,
  '숙박': stay,
}

/**
 * 상위 HomePage가 조회한 즐길거리 데이터를 props로 받아
 * 선택된 카테고리에 맞게 필터링합니다.
 */

export default function ThemeDestinationSection({
  enjoyItems = [],
  isLoading,
  errorMessage,
}) {

  /**
   * 현재 사용자가 선택한 필터입니다.
   */
  const [activeFilter, setActiveFilter] = useState('전체')

  
  /**
   * 전체 필터에 표시할 대표 카드 목록을 만듭니다.
   *
   * 전체 필터에서는 각 카테고리의 첫 번째 데이터만 선택해
   * 기존 화면과 동일하게 총 5개를 표시합니다.
   */
  const representativeItems = filters
    /*
     * '전체'는 실제 데이터의 카테고리명이 아니므로 제외합니다.
     */
    .filter((filter) => filter !== '전체')

    /*
     * 각 카테고리에서 첫 번째 데이터를 찾습니다.
     *
     * 백엔드가 Q 정렬로 데이터를 내려주므로
     * 첫 번째 데이터가 해당 카테고리의 대표 카드가 됩니다.
     */
    .map((category) => enjoyItems.find(
      (item) => item.category === category,
    ),
  )
  
  /*
   * 특정 카테고리의 조회 결과가 없는 경우
   * find()가 undefined를 반환하므로 제거합니다.
   */
  .filter(Boolean)

  /**
    * 사용자가 선택한 필터에 맞춰 화면에 표시할 데이터를 만듭니다.
    *
    * 전체:
    * 카테고리별 첫 번째 카드만 선택해 최대 5개 표시
    *
    * 특정 카테고리:
    * 해당 카테고리 데이터만 선택해 최대 5개 표시
    */

  const filteredItems = activeFilter === '전체'
    ? representativeItems
    : enjoyItems.filter((item) => item.category === activeFilter).slice(0, 5)

  return (
  <section id="enjoy" className="home-section enjoy-section">
    <div className="section-heading">
      <div>
        <h2>여행을 더 즐겁게</h2>
        <p>축제부터 레포츠, 음식점, 쇼핑, 숙박까지 여행의 즐거움을 더해보세요.</p>
      </div>
    </div>
    {/*
       * 카테고리 필터 버튼입니다.
       */}
    <div className="enjoy-filters" role="group" aria-label="여행 즐길거리 필터">
      {/* aria-pressed를 함께 갱신해 키보드·스크린리더에서도 선택 상태를 알 수 있게 합니다. */}
      {filters.map((filter) => (
        <button
          className={activeFilter === filter ? 'is-active' : ''}
          type="button"
          aria-pressed={activeFilter === filter}
          onClick={() => setActiveFilter(filter)}
          key={filter}
        >
          {filter}
        </button>
      ))}
    </div>

      {/* API 요청 진행 중 */}
      {isLoading && (
        <p className="home-section__status">
          여행 즐길거리를 불러오는 중입니다.
        </p>
      )}

      {/* API 요청 실패 */}
      {!isLoading && errorMessage && (
        <p className="home-section__status home-section__status--error">
          {errorMessage}
        </p>
      )}

      {/* 정상 응답이지만 데이터가 없는 경우 */}
      {!isLoading &&
        !errorMessage &&
        filteredItems.length === 0 && (
          <p className="home-section__status">
            현재 표시할 즐길거리가 없습니다.
          </p>
        )}
    {/* 즐길거리 카드 목록 */}
    {!isLoading && !errorMessage && filteredItems.length > 0 && (
      <div className="enjoy-grid">
        {filteredItems.map((item) => (
          <article className="enjoy-card" key={item.contentId}>
            <Link to={`/destinations/detail/${item.contentId}?contentTypeId=${item.contentTypeId}`}>
              <img src={item.image || fallbackImages[item.category] || stay} alt={item.title} />
              <div>
                <h3>{item.title}</h3>
                <p className="location-with-pin" title={item.location || '위치 정보 없음'}>
                  <PlacePinIcon />
                  {/*
                    * 긴 주소에 말줄임표를 적용하기 위해
                    * 주소 문자열을 별도의 span으로 감쌉니다.
                    *
                    * title 속성으로 마우스를 올렸을 때
                    * 전체 주소를 확인할 수 있습니다.
                    */}
                  <span>{item.location || '위치 정보 없음'}</span>
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    )}
  </section>
  )
}

/**
 * 초기 구현에서는 각 홈 섹션이 /api/home을 개별 호출해
 * 동일 요청이 중복되었습니다. 
 * 이를 개선해 상위 HomePage에서 API를 한 번만 호출하고, 
 * 추천 여행지·추천 코스·즐길거리 데이터를 props로 
 * 각 컴포넌트에 전달하도록 구조를 변경했습니다.
 */