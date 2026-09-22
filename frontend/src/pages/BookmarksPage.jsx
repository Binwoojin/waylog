import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import './BookmarksPage.css'

const groups = [
  { value: 'DESTINATION', label: '여행지' },
  { value: 'ENJOY', label: '즐길거리' },
]

export default function BookmarksPage() {
  const { member } = useAuth()
  const [group, setGroup] = useState('DESTINATION')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!member) return undefined

    let cancelled = false

    async function loadBookmarks() {
      setStatus('loading')

      try {
        const data = await apiClient.get(`/api/v1/tour-bookmarks?group=${group}&page=${page}&size=9`)
        if (cancelled) return
        setItems(data.content || [])
        setTotalPages(data.totalPages || 0)
        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    loadBookmarks()

    return () => {
      cancelled = true
    }
  }, [member, group, page])

  if (!member) {
    return <Navigate to="/login" replace />
  }

  const changeGroup = nextGroup => {
    setGroup(nextGroup)
    setPage(1)
  }

  return (
    <main className="bookmarks-page">
      <div className="bookmarks-page__inner">
        <h1>내 북마크</h1>

        <div className="bookmarks-page__tabs" role="tablist" aria-label="북마크 분류">
          {groups.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={group === value}
              className={group === value ? 'is-active' : ''}
              onClick={() => changeGroup(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {status === 'loading' && <p className="bookmarks-page__status">불러오는 중입니다.</p>}
        {status === 'error' && <p className="bookmarks-page__status">북마크를 불러오지 못했습니다.</p>}
        {status === 'ready' && items.length === 0 && (
          <p className="bookmarks-page__status">저장한 북마크가 없습니다.</p>
        )}

        {status === 'ready' && items.length > 0 && (
          <div className="bookmarks-page__grid">
            {items.map(item => (
              <Link
                key={item.bookmarkId}
                className="bookmarks-page__card"
                to={`/destinations/detail/${item.contentId}?contentTypeId=${item.contentTypeId}`}
              >
                {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                <div>
                  {item.categoryName && <span className="bookmarks-page__tag">{item.categoryName}</span>}
                  <h3>{item.title}</h3>
                  {item.address && (
                    <p><PlacePinIcon size={15} />{item.address}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="bookmarks-page__pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>이전</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)}>다음</button>
          </div>
        )}
      </div>
    </main>
  )
}
