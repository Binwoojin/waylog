import { useId, useState } from 'react'

/**
 * 관리자 목록 화면의 검색어 입력 (표시 컴포넌트)
 *
 * Design Ref: admin-dashboard.design.md §2.2 — URL의 keyword를 그대로 반영하되,
 * 입력 중에는 로컬 draft만 바꾸고 제출(Enter·검색 버튼)해야 실제 검색(URL 변경)이 일어납니다.
 * 매 입력마다 URL이 바뀌어 목록이 다시 조회되는 것을 막기 위해서입니다.
 *
 * value가 바뀌면(뒤로 가기, 초기화 등 외부 요인) draft도 맞춰야 하는데, effect에서 setState하면
 * react-hooks/set-state-in-effect에 걸립니다. 대신 호출하는 쪽이 key={value}로 이 컴포넌트를
 * 다시 마운트해 주세요(useAdminNoticeDetail 등과 같은 "key 재마운트" 관례).
 */
export default function AdminSearchBar({ value, onSearch, placeholder = '제목·작성자로 검색' }) {
  const [draft, setDraft] = useState(value)
  const inputId = useId()

  function handleSubmit(event) {
    event.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <form className="admin-search-bar" role="search" onSubmit={handleSubmit}>
      <label className="admin-visually-hidden" htmlFor={inputId}>검색어</label>
      <input
        id={inputId}
        type="search"
        value={draft}
        placeholder={placeholder}
        onChange={event => setDraft(event.target.value)}
      />
      <button type="submit" className="admin-button">검색</button>
    </form>
  )
}
