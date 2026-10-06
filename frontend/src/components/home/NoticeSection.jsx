import { useEffect, useState } from 'react'
import { fetchNoticeList } from '../../api/noticeApi'
import { isAbortError } from '../../api/client'
import SectionStatus from '../common/SectionStatus'
import './HomeSections.css'

const NOTICE_PREVIEW_SIZE = 3

// createdAt(ISO 날짜 문자열)의 날짜 부분을 'yyyy.MM.dd'로 바꿉니다. 형식이 다르면 날짜를 생략합니다.
function formatNoticeDate(value) {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
  return match ? `${match[1]}.${match[2]}.${match[3]}` : ''
}

/**
 * 홈의 공지사항 미리보기입니다. GET /api/v1/notices(공개)의 최신 3건을 보여 줍니다.
 *
 * 공지 상세 화면과 공개 공지 목록 화면은 아직 없습니다.
 * 그래서 항목과 "전체 보기" 링크는 이동 경로가 없는 상태로 두지 않으려고 링크를 만들지 않습니다.
 */
export default function NoticeSection() {
  // attempt는 재시도 횟수입니다. 값이 바뀌면 요청을 다시 보냅니다.
  const [attempt, setAttempt] = useState(0)
  // 마지막으로 끝난 요청의 결과입니다. attempt가 다르면 아직 응답이 없는 것으로 파생합니다.
  const [settled, setSettled] = useState({ attempt: null, items: [], failed: false })

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    fetchNoticeList({ page: 1, size: NOTICE_PREVIEW_SIZE }, { signal: controller.signal })
      .then(data => {
        if (isActive) setSettled({ attempt, items: data.items, failed: false })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        console.error('공지사항을 불러오지 못했습니다.', error)
        setSettled({ attempt, items: [], failed: true })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [attempt])

  const isLoading = settled.attempt !== attempt
  const hasError = !isLoading && settled.failed
  const items = isLoading || settled.failed ? [] : settled.items

  return (
    <section className="home-section notice-section">
      <div className="section-heading">
        <div><h2>공지사항</h2></div>
      </div>

      {isLoading && <SectionStatus variant="loading" message="공지사항을 불러오는 중입니다." />}

      {hasError && (
        <SectionStatus variant="error" message="공지사항을 불러오지 못했습니다." onRetry={() => setAttempt(value => value + 1)} />
      )}

      {!isLoading && !hasError && items.length === 0 && (
        <SectionStatus message="등록된 공지사항이 없습니다." />
      )}

      {items.length > 0 && (
        <ul>
          {items.map(item => {
            const date = formatNoticeDate(item.createdAt)
            return (
              <li key={item.id}>
                {/* 공지 유형 값이 API에 없으므로 모든 항목에 공통인 배지를 씁니다. */}
                <span className="notice-badge">공지</span>
                <span>{item.title}</span>
                {date && <time dateTime={item.createdAt}>{date}</time>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
