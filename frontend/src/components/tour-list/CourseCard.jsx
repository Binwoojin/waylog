import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlacePinIcon from '../icons/PlacePinIcon'
import { formatCourseDuration } from '../../api/courseApi'
import defaultImage from '../../assets/figma/destination-jeju.png'

/**
 * 여행코스 카드 (표시 컴포넌트)
 *
 * Design Ref: tour-course-list-integration.design.md §7.3 — TourCard와 마크업 골격(catalog-card,
 * tour-list__card-* 클래스)을 공유해 그리드 안에서 시각적으로 이질감이 없게 합니다. 차이는
 * 분류 배지 대신 테마 배지, 그리고 기간·경유지 수 한 줄이 추가된 것뿐입니다.
 * CourseCard view model만 받습니다(훅·API를 import하지 않습니다).
 */
export default function CourseCard({ card }) {
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
        {card.theme && <span className="catalog-card__image-tag">{card.theme}</span>}
        <div className="tour-list__card-body">
          <h2 className="tour-list__card-title">{card.title}</h2>
          <small className="tour-list__card-meta">
            {formatCourseDuration(card.dayCount)} · {card.stopCount}곳
          </small>
          {card.representativeAddress && (
            <small className="catalog-address tour-list__card-address">
              <PlacePinIcon />
              <span>{card.representativeAddress}</span>
            </small>
          )}
        </div>
      </Link>
    </article>
  )
}
