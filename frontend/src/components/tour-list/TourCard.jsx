import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlacePinIcon from '../icons/PlacePinIcon'
import defaultImage from '../../assets/figma/destination-jeju.png'

/**
 * 여행지 카드 (표시 컴포넌트)
 *
 * Design Ref: §5.8 FR-10 — TourCard view model만 받습니다. 훅·API를 import하지 않습니다.
 * - 카드 전체가 상세 링크입니다. 링크는 getTourDetailPath가 만든 내부 경로뿐입니다(§7).
 * - 북마크 버튼은 두지 않습니다(Q-1). 저장되지 않는 버튼은 사용자를 속입니다.
 * - 이미지 alt는 비웁니다. 바로 옆 제목과 중복 낭독되기 때문입니다.
 * - 이미지가 없거나 로드에 실패하면 상세와 같은 기본 이미지를 씁니다. 실패는 한 번만 교체합니다.
 *   호출하는 쪽이 key=card.id로 렌더하므로 다른 카드로 바뀌면 이 state도 초기화됩니다.
 */
export default function TourCard({ card }) {
  const [isImageBroken, setIsImageBroken] = useState(false)
  const image = card.image && !isImageBroken ? card.image : defaultImage

  return (
    <article className="catalog-card">
      <Link className="catalog-card__link" to={card.detailPath}>
        <img
          className="tour-list__card-image"
          src={image}
          alt=""
          width="480"
          height="360"
          loading="lazy"
          decoding="async"
          onError={() => setIsImageBroken(true)}
        />
        {card.category && <span className="catalog-card__image-tag">{card.category}</span>}
        <div className="tour-list__card-body">
          <h2 className="tour-list__card-title">{card.title}</h2>
          <small className="catalog-address tour-list__card-address">
            <PlacePinIcon />
            <span>{card.address}</span>
          </small>
        </div>
      </Link>
    </article>
  )
}
