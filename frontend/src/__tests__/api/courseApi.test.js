import { describe, expect, it } from 'vitest'
import {
  formatCourseDuration,
  getCourseDetailPath,
  toCourseCard,
  toCourseDetail,
  toCourseList,
} from '../../api/courseApi'

function courseItem(overrides = {}) {
  return {
    id: 3,
    title: '제주 2박 3일 바다 코스',
    theme: '바다',
    coverImageUrl: 'https://img.example/jeju.jpg',
    dayCount: 3,
    stopCount: 7,
    representativeAddress: '제주특별자치도 제주시',
    ...overrides,
  }
}

describe('formatCourseDuration', () => {
  it('당일치기와 N박 N+1일 형식으로 만든다', () => {
    expect(formatCourseDuration(1)).toBe('당일치기')
    expect(formatCourseDuration(2)).toBe('1박 2일')
    expect(formatCourseDuration(3)).toBe('2박 3일')
  })

  it.each([0, -1, 1.5, '3', null, undefined])('잘못된 일수(%s)는 일정 미정', value => {
    expect(formatCourseDuration(value)).toBe('일정 미정')
  })
})

describe('getCourseDetailPath', () => {
  it('코스 상세 경로를 만든다', () => {
    expect(getCourseDetailPath(3)).toBe('/destinations/courses/3')
  })

  it('id를 경로에 넣기 전에 인코딩한다', () => {
    expect(getCourseDetailPath('a/b c')).toBe('/destinations/courses/a%2Fb%20c')
  })
})

describe('toCourseCard', () => {
  it('정상 항목을 카드 view model로 바꾼다', () => {
    expect(toCourseCard(courseItem())).toEqual({
      id: '3',
      title: '제주 2박 3일 바다 코스',
      theme: '바다',
      image: 'https://img.example/jeju.jpg',
      dayCount: 3,
      stopCount: 7,
      representativeAddress: '제주특별자치도 제주시',
      detailPath: '/destinations/courses/3',
    })
  })

  it('제목 앞뒤 공백을 자르고, 공백뿐인 제목이면 버린다', () => {
    expect(toCourseCard(courseItem({ title: '  코스  ' })).title).toBe('코스')
    expect(toCourseCard(courseItem({ title: '   ' }))).toBeNull()
    expect(toCourseCard(courseItem({ title: null }))).toBeNull()
  })

  it('id가 없으면 버린다(상세 링크를 만들 수 없음)', () => {
    expect(toCourseCard(courseItem({ id: null }))).toBeNull()
    expect(toCourseCard(courseItem({ id: undefined }))).toBeNull()
  })

  it('일수·경유지 수가 음수이거나 정수가 아니면 0으로 본다', () => {
    const card = toCourseCard(courseItem({ dayCount: -2, stopCount: 1.5 }))
    expect(card.dayCount).toBe(0)
    expect(card.stopCount).toBe(0)
  })

  it('빈 텍스트 필드(테마, 이미지, 주소)는 null', () => {
    const card = toCourseCard(courseItem({ theme: '  ', coverImageUrl: '', representativeAddress: null }))
    expect(card.theme).toBeNull()
    expect(card.image).toBeNull()
    expect(card.representativeAddress).toBeNull()
  })

  it('객체가 아닌 값은 null', () => {
    expect(toCourseCard(null)).toBeNull()
    expect(toCourseCard('3')).toBeNull()
  })
})

describe('toCourseList', () => {
  const page = (overrides = {}) => ({
    content: [courseItem({ id: 1 }), courseItem({ id: 2 })],
    totalElements: 12,
    totalPages: 2,
    ...overrides,
  })

  it('서버의 totalElements·totalPages를 쓰고, page는 요청값(1-based)을 쓴다', () => {
    const result = toCourseList(page(), 2)
    expect(result.items.map(item => item.id)).toEqual(['1', '2'])
    expect(result.totalCount).toBe(12)
    expect(result.totalPages).toBe(2)
    expect(result.page).toBe(2)
  })

  it('요청 page가 잘못되었으면 1로 본다', () => {
    expect(toCourseList(page(), 0).page).toBe(1)
    expect(toCourseList(page(), undefined).page).toBe(1)
  })

  it('totalPages가 없으면 0', () => {
    expect(toCourseList(page({ totalPages: undefined }), 1).totalPages).toBe(0)
  })

  it('같은 id는 한 번만, 형식이 틀린 항목은 버린다', () => {
    const result = toCourseList(page({ content: [courseItem({ id: 5 }), courseItem({ id: 5 }), { id: 6, title: '' }] }), 1)
    expect(result.items.map(item => item.id)).toEqual(['5'])
  })

  it('content가 배열이 아니거나 totalElements가 잘못되면 오류(fail-closed)', () => {
    expect(() => toCourseList({}, 1)).toThrow('여행코스 목록 응답 형식이 올바르지 않습니다.')
    expect(() => toCourseList(page({ content: null }), 1)).toThrow()
    expect(() => toCourseList(page({ totalElements: -1 }), 1)).toThrow()
    expect(() => toCourseList(page({ totalElements: '12' }), 1)).toThrow()
  })
})

describe('toCourseDetail', () => {
  const detail = (overrides = {}) => ({
    id: 3,
    title: '  제주 코스  ',
    theme: '바다',
    coverImageUrl: 'https://img.example/c.jpg',
    days: [],
    ...overrides,
  })

  it('제목을 자르고 필드를 정리한다', () => {
    const result = toCourseDetail(detail())
    expect(result).toEqual({
      id: 3,
      title: '제주 코스',
      theme: '바다',
      coverImageUrl: 'https://img.example/c.jpg',
      days: [],
    })
  })

  it('일자는 dayNumber 순으로 정렬한다', () => {
    const result = toCourseDetail(detail({
      days: [
        { id: 2, dayNumber: 2, stops: [] },
        { id: 1, dayNumber: 1, stops: [] },
        { id: 3, dayNumber: 3, stops: [] },
      ],
    }))
    expect(result.days.map(day => day.dayNumber)).toEqual([1, 2, 3])
  })

  it('경유지 유형은 CUSTOM만 그대로 두고 나머지는 REFERENCE로 본다', () => {
    const result = toCourseDetail(detail({
      days: [{
        dayNumber: 1,
        stops: [
          { stopType: 'CUSTOM', name: '카페' },
          { stopType: 'WHATEVER', name: '해변' },
          { name: null },
        ],
      }],
    }))
    const [custom, unknown, missing] = result.days[0].stops
    expect(custom.stopType).toBe('CUSTOM')
    expect(unknown.stopType).toBe('REFERENCE')
    expect(missing.stopType).toBe('REFERENCE')
    expect(missing.name).toBe('')
  })

  it('경유지의 좌표가 숫자가 아니거나 tourContentTypeId가 정수가 아니면 null', () => {
    const [stop] = toCourseDetail(detail({
      days: [{ dayNumber: 1, stops: [{ latitude: '33.5', longitude: 126.5, tourContentTypeId: '12' }] }],
    })).days[0].stops
    expect(stop.latitude).toBeNull()
    expect(stop.longitude).toBe(126.5)
    expect(stop.tourContentTypeId).toBeNull()
  })

  it('dayNumber가 정수가 아니면 1로 본다', () => {
    expect(toCourseDetail(detail({ days: [{ dayNumber: '2', stops: [] }] })).days[0].dayNumber).toBe(1)
  })

  it('제목이 없거나 days가 배열이 아니면 오류', () => {
    expect(() => toCourseDetail(detail({ title: '' }))).toThrow('여행코스 상세 응답 형식이 올바르지 않습니다.')
    expect(() => toCourseDetail(detail({ days: null }))).toThrow()
    expect(() => toCourseDetail(null)).toThrow()
  })
})
