import { describe, expect, it } from 'vitest'
import { toTelHref, toTourCard, toTourDetail, toTourList } from '../../api/tourApi'

const EMPTY_ADDRESS = '주소 정보 없음'

function summary(overrides = {}) {
  return {
    contentId: 126508,
    contentTypeId: 12,
    title: '경복궁',
    address: '서울특별시 종로구 사직로 161',
    image: 'https://img.example/gyeongbokgung.jpg',
    thumbnail: null,
    lclsSystm1Nm: '자연',
    lclsSystm2Nm: '자연관광지',
    latitude: 37.5796,
    longitude: 126.977,
    ...overrides,
  }
}

describe('toTourCard', () => {
  it('정상 항목을 카드 view model로 바꾼다', () => {
    expect(toTourCard(summary())).toEqual({
      id: '126508',
      title: '경복궁',
      address: '서울특별시 종로구 사직로 161',
      image: 'https://img.example/gyeongbokgung.jpg',
      category: '자연관광지',
      detailPath: '/destinations/detail/126508?type=12',
      contentTypeId: 12,
      latitude: 37.5796,
      longitude: 126.977,
    })
  })

  it('중분류 이름이 없으면 대분류 이름을, 둘 다 없으면 null을 쓴다', () => {
    expect(toTourCard(summary({ lclsSystm2Nm: '' })).category).toBe('자연')
    expect(toTourCard(summary({ lclsSystm1Nm: null, lclsSystm2Nm: null })).category).toBeNull()
  })

  it('이미지가 빈 문자열이면 썸네일로 대체하고, 둘 다 없으면 null', () => {
    expect(toTourCard(summary({ image: '  ', thumbnail: 'https://img.example/t.jpg' })).image)
      .toBe('https://img.example/t.jpg')
    expect(toTourCard(summary({ image: '', thumbnail: null })).image).toBeNull()
  })

  it('주소가 없으면 안내 문구로 대체한다', () => {
    expect(toTourCard(summary({ address: '   ' })).address).toBe(EMPTY_ADDRESS)
  })

  it('좌표가 숫자가 아니면 null', () => {
    const card = toTourCard(summary({ latitude: '37.5', longitude: null }))
    expect(card.latitude).toBeNull()
    expect(card.longitude).toBeNull()
  })

  it('항목에 contentTypeId가 없으면 요청 유형(fallback)으로 상세 경로를 만든다', () => {
    const card = toTourCard(summary({ contentTypeId: undefined }), 14)
    expect(card.detailPath).toBe('/destinations/detail/126508?type=14')
    expect(card.contentTypeId).toBe(14)
  })

  it('즐기기 유형이면 즐기기 상세 경로를 쓴다', () => {
    expect(toTourCard(summary({ contentTypeId: 39 })).detailPath).toBe('/enjoy/food/126508')
  })

  it('contentId가 숫자가 아니면 버린다(상세 링크를 만들 수 없음)', () => {
    expect(toTourCard(summary({ contentId: 'abc' }))).toBeNull()
    expect(toTourCard(summary({ contentId: '12-34' }))).toBeNull()
    expect(toTourCard(summary({ contentId: null }))).toBeNull()
  })

  it('제목이 없거나 공백뿐이면 버린다', () => {
    expect(toTourCard(summary({ title: null }))).toBeNull()
    expect(toTourCard(summary({ title: '   ' }))).toBeNull()
  })

  it('상세 경로를 정할 수 없는 유형(99, 유형 없음)이면 버린다', () => {
    expect(toTourCard(summary({ contentTypeId: 99 }))).toBeNull()
    expect(toTourCard(summary({ contentTypeId: undefined }), undefined)).toBeNull()
  })

  it('null과 객체가 아닌 값은 null', () => {
    expect(toTourCard(null)).toBeNull()
    expect(toTourCard('126508')).toBeNull()
  })
})

describe('toTourList', () => {
  const data = (overrides = {}) => ({
    items: [summary({ contentId: 1 }), summary({ contentId: 2 })],
    totalCount: 20,
    page: 1,
    ...overrides,
  })

  it('정상 응답을 목록 결과로 바꾸고, totalPages를 요청한 size로 계산한다', () => {
    const result = toTourList(data(), { size: 9, page: 1, contentTypeId: 12 })
    expect(result.items.map(item => item.id)).toEqual(['1', '2'])
    expect(result.totalCount).toBe(20)
    expect(result.totalPages).toBe(3)
    expect(result.page).toBe(1)
  })

  it('totalCount가 0이면 totalPages도 0', () => {
    expect(toTourList(data({ items: [], totalCount: 0 }), { size: 9, page: 1 }).totalPages).toBe(0)
  })

  it('같은 contentId가 두 번 오면 첫 항목만 남긴다(React key 중복 방지)', () => {
    const result = toTourList(data({ items: [summary({ contentId: 5, title: 'A' }), summary({ contentId: 5, title: 'B' })] }), { size: 9, page: 1 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe('A')
  })

  it('형식이 맞지 않는 항목은 버리되 totalCount는 서버 값을 그대로 쓴다', () => {
    const result = toTourList(data({ items: [summary({ contentId: 'bad' }), summary({ contentId: 7 })], totalCount: 40 }), { size: 9, page: 1 })
    expect(result.items.map(item => item.id)).toEqual(['7'])
    expect(result.totalCount).toBe(40)
  })

  it('page는 요청한 값을 우선하고, 요청값이 없으면 응답 page, 그것도 없으면 1', () => {
    expect(toTourList(data({ page: 4 }), { size: 9, page: 2 }).page).toBe(2)
    expect(toTourList(data({ page: 4 }), { size: 9 }).page).toBe(4)
    expect(toTourList(data({ page: 0 }), { size: 9, page: 0 }).page).toBe(1)
  })

  it('items가 배열이 아니면 오류(fail-closed: JSON이 아닌 200 응답은 {}로 옴)', () => {
    expect(() => toTourList({}, { size: 9 })).toThrow('목록 응답 형식이 올바르지 않습니다.')
    expect(() => toTourList({ items: 'x', totalCount: 1 }, { size: 9 })).toThrow()
  })

  it('totalCount가 음수·소수·문자열이면 오류', () => {
    expect(() => toTourList(data({ totalCount: -1 }), { size: 9 })).toThrow()
    expect(() => toTourList(data({ totalCount: 1.5 }), { size: 9 })).toThrow()
    expect(() => toTourList(data({ totalCount: '20' }), { size: 9 })).toThrow()
  })

  it('응답이 null이면 오류', () => {
    expect(() => toTourList(null, { size: 9 })).toThrow()
  })
})

describe('toTelHref', () => {
  it.each([
    ['02-1234-5678', 'tel:0212345678'],
    ['010-1234-5678', 'tel:01012345678'],
    ['(064)710-7912', 'tel:0647107912'],
    ['1588-1234', 'tel:15881234'],
    ['+82-2-1234-5678', 'tel:+82212345678'],
    ['문의: 02-1234-5678 (평일 09:00~18:00)', 'tel:0212345678'],
  ])('전화번호 하나인 문의처 %s → %s', (contact, href) => {
    expect(toTelHref(contact)).toBe(href)
  })

  it('번호가 여러 개면 어느 번호로 걸지 정할 수 없으므로 null', () => {
    expect(toTelHref('02-1234-5678 / 010-1234-5678')).toBeNull()
  })

  it('범위 번호(~로 이어짐)는 null', () => {
    expect(toTelHref('02-3700-3900~1')).toBeNull()
  })

  it('번호 밖에 긴 숫자가 남아 있으면 인식하지 못한 다른 번호일 수 있으므로 null', () => {
    expect(toTelHref('1330 1588-1234')).toBeNull()
    expect(toTelHref('02-1234-5678 내선 12345')).toBeNull()
  })

  it('번호가 없으면 null, 문자열이 아니면 null', () => {
    expect(toTelHref('문의 없음')).toBeNull()
    expect(toTelHref('')).toBeNull()
    expect(toTelHref(null)).toBeNull()
    expect(toTelHref(undefined)).toBeNull()
  })
})

describe('toTourDetail (DOM 없이 처리되는 경로)', () => {
  it('제목이 없거나 공백이면 오류(빈 상세 화면 방지)', () => {
    expect(() => toTourDetail({ title: '' })).toThrow('상세 응답 형식이 올바르지 않습니다.')
    expect(() => toTourDetail({ title: '  ' })).toThrow()
    expect(() => toTourDetail({})).toThrow()
    expect(() => toTourDetail(null)).toThrow()
  })

  it('정상 응답을 view model로 바꾸고 제목 앞뒤 공백을 자른다', () => {
    const detail = toTourDetail({
      contentId: 126508,
      title: '  경복궁  ',
      image: 'https://img.example/a.jpg',
      address: ' 서울 종로구 ',
      contentTypeName: '관광지',
      bookmarked: 1,
    })

    expect(detail).toEqual({
      source: 'api',
      id: '126508',
      title: '경복궁',
      image: 'https://img.example/a.jpg',
      address: '서울 종로구',
      typeLabel: '관광지',
      description: '',
      infos: [],
      contact: null,
      bookmarked: true,
    })
  })

  it('주소와 이미지가 비어 있으면 대체 값을 쓰고, bookmarked가 없으면 false', () => {
    const detail = toTourDetail({ title: '경복궁', address: '', image: '   ' })
    expect(detail.address).toBe(EMPTY_ADDRESS)
    expect(detail.image).toBeNull()
    expect(detail.bookmarked).toBe(false)
  })

  it('detailInfos가 배열이 아니면 빈 목록으로 본다', () => {
    expect(toTourDetail({ title: '경복궁', detailInfos: 'oops' }).infos).toEqual([])
  })
})
