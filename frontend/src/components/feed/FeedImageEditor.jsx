import './FeedImageEditor.css'

/**
 * 이미지 미리보기 + 순서 변경 + 개별 삭제 (표시 컴포넌트)
 *
 * Design Ref: feed-integration.design.md §6.2(Q-5) — 새 드래그 라이브러리를 추가하지 않고
 * HTML5 네이티브 드래그(draggable)로 순서를 바꾼다. 다만 네이티브 드래그는 마우스 전용이라
 * 키보드·스크린리더 사용자가 순서를 바꿀 수 없으므로, 각 썸네일에 "앞으로/뒤로 이동" 버튼을
 * 호버 여부와 관계없이 항상 노출한다(숨겨진 버튼은 키보드 포커스로 찾기 어렵다).
 *
 * images: [{ localId, file, previewUrl }]
 */
export default function FeedImageEditor({ images, onReorder, onRemove }) {
  function moveBy(index, delta) {
    const target = index + delta
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    onReorder(next)
  }

  function handleDrop(event, dropIndex) {
    event.preventDefault()
    const fromIndex = Number(event.dataTransfer.getData('text/plain'))
    if (!Number.isInteger(fromIndex) || fromIndex === dropIndex) return

    const next = [...images]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(dropIndex, 0, moved)
    onReorder(next)
  }

  if (images.length === 0) return null

  return (
    <ul className="feed-image-editor" aria-label="첨부한 사진 순서">
      {images.map((image, index) => (
        <li
          key={image.localId}
          className="feed-image-editor__item"
          draggable
          onDragStart={event => event.dataTransfer.setData('text/plain', String(index))}
          onDragOver={event => event.preventDefault()}
          onDrop={event => handleDrop(event, index)}
        >
          <img className="feed-image-editor__thumb" src={image.previewUrl} alt="" />
          {index === 0 && <span className="feed-image-editor__badge">대표</span>}
          <div className="feed-image-editor__controls">
            <button
              type="button"
              aria-label="앞으로 이동"
              disabled={index === 0}
              onClick={() => moveBy(index, -1)}
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="뒤로 이동"
              disabled={index === images.length - 1}
              onClick={() => moveBy(index, 1)}
            >
              ▶
            </button>
            <button type="button" aria-label="사진 삭제" onClick={() => onRemove(image.localId)}>
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
