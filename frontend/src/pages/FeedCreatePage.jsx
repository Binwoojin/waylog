import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import './FeedCreatePage.css'

const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function FeedCreatePage() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [locationName, setLocationName] = useState('')
  const [address, setAddress] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)

  if (!member) {
    return <Navigate to="/login" replace />
  }

  const handleImageChange = event => {
    const files = Array.from(event.target.files || [])

    if (files.length > MAX_IMAGES) {
      window.alert(`사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }

    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE) {
        window.alert('이미지 한 장은 5MB 이하만 업로드할 수 있습니다.')
        return
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        window.alert('JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.')
        return
      }
    }

    setImages(files)
  }

  const handleSubmit = async event => {
    event.preventDefault()

    if (!content.trim()) {
      window.alert('게시글 내용을 입력해 주세요.')
      return
    }

    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 10)

    const post = {
      content: content.trim(),
      locationName: locationName.trim() || null,
      address: address.trim() || null,
      tourContentId: null,
      tourContentTypeId: null,
      visibility,
      tags,
      imageUrls: [],
    }

    const formData = new FormData()
    formData.append('post', new Blob([JSON.stringify(post)], { type: 'application/json' }))
    images.forEach(file => formData.append('images', file))

    setSubmitting(true)
    try {
      const response = await apiClient.post('/api/v1/feed/posts', formData)
      navigate(`/feed/${response.id}`)
    } catch (error) {
      window.alert(error.message || '게시글 등록 중 문제가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="feed-create-page">
      <div className="feed-create-page__inner">
        <h1>여행 기록 남기기</h1>

        <form onSubmit={handleSubmit}>
          <label htmlFor="feed-content">내용</label>
          <textarea
            id="feed-content"
            rows={6}
            maxLength={2000}
            value={content}
            onChange={event => setContent(event.target.value)}
            placeholder="오늘의 여행 이야기를 남겨보세요."
          />

          <div className="feed-create-page__row">
            <div>
              <label htmlFor="feed-location">장소명</label>
              <input id="feed-location" value={locationName} onChange={event => setLocationName(event.target.value)} placeholder="예: 성산일출봉" maxLength={150} />
            </div>
            <div>
              <label htmlFor="feed-address">주소</label>
              <input id="feed-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="예: 제주특별자치도 서귀포시" maxLength={255} />
            </div>
          </div>

          <label htmlFor="feed-tags">해시태그 (쉼표로 구분, 최대 10개)</label>
          <input id="feed-tags" value={tagsInput} onChange={event => setTagsInput(event.target.value)} placeholder="제주, 바다, 힐링" />

          <label htmlFor="feed-images">사진 (최대 5장)</label>
          <input id="feed-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageChange} />
          {images.length > 0 && <p className="feed-create-page__hint">{images.length}장 선택됨</p>}

          <fieldset className="feed-create-page__visibility">
            <legend>공개 범위</legend>
            <label>
              <input type="radio" name="visibility" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} />
              전체 공개
            </label>
            <label>
              <input type="radio" name="visibility" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} />
              나만 보기
            </label>
          </fieldset>

          <button type="submit" disabled={submitting}>{submitting ? '등록 중...' : '게시하기'}</button>
        </form>
      </div>
    </main>
  )
}
