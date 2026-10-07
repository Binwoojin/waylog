import { describe, expect, it } from 'vitest'
import {
  ENJOY_LIST_PAGE_SIZE,
  applyEnjoyQueryPatch,
  buildEnjoySearchPath,
  createEnjoyListQuery,
  getEnjoyTypeLabel,
  parseEnjoyListQuery,
  serializeEnjoyListQuery,
  toEnjoyApiParams,
} from '../../lib/enjoyListQuery'

describe('parseEnjoyListQuery', () => {
  it('정상 URL을 query로 읽는다', () => {
    expect(parseEnjoyListQuery('?contentTypeId=39&arrange=O&page=3')).toEqual({
      contentTypeId: 39,
      arrange: 'O',
      page: 3,
    })
  })

  it('URLSearchParams 객체도 받는다', () => {
    const params = new URLSearchParams('contentTypeId=15')
    expect(parseEnjoyListQuery(params)).toEqual({ contentTypeId: 15, arrange: 'Q', page: 1 })
  })

  it('유형이 없거나 빈 값이면 null(검색 조건 없음)', () => {
    expect(parseEnjoyListQuery('')).toBeNull()
    expect(parseEnjoyListQuery(undefined)).toBeNull()
    expect(parseEnjoyListQuery('?arrange=O&page=2')).toBeNull()
    expect(parseEnjoyListQuery('?contentTypeId=')).toBeNull()
  })

  it('허용되지 않은 유형(관광지 12, 알 수 없는 값)은 null', () => {
    expect(parseEnjoyListQuery('?contentTypeId=12')).toBeNull()
    expect(parseEnjoyListQuery('?contentTypeId=99')).toBeNull()
    expect(parseEnjoyListQuery('?contentTypeId=abc')).toBeNull()
  })

  it('숫자 표기가 다른 유형 값(0x0f, 15.0)은 허용하지 않는다(tourListQuery와 같은 문자열 비교 규칙)', () => {
    expect(parseEnjoyListQuery('?contentTypeId=0x0f')).toBeNull()
    expect(parseEnjoyListQuery('?contentTypeId=15.0')).toBeNull()
  })

  it('허용되지 않은 정렬 값은 기본값 Q로 바꾼다', () => {
    expect(parseEnjoyListQuery('?contentTypeId=28&arrange=X').arrange).toBe('Q')
    expect(parseEnjoyListQuery('?contentTypeId=28&arrange=').arrange).toBe('Q')
  })

  it.each(['0', '01', '-1', '1.5', '10000', 'abc', ''])('잘못된 page(%s)는 1로 보정한다', page => {
    expect(parseEnjoyListQuery({ contentTypeId: '15', page }).page).toBe(1)
  })

  it('형식에 맞는 큰 page(9999)는 그대로 둔다', () => {
    expect(parseEnjoyListQuery('?contentTypeId=15&page=9999').page).toBe(9999)
  })

  it('같은 키가 여러 번 오면 첫 값만 쓴다', () => {
    expect(parseEnjoyListQuery('?contentTypeId=15&contentTypeId=39').contentTypeId).toBe(15)
  })
})

describe('createEnjoyListQuery', () => {
  it('문자열과 숫자 유형을 모두 받아 같은 query를 만든다', () => {
    expect(createEnjoyListQuery({ contentTypeId: '15' })).toEqual({ contentTypeId: 15, arrange: 'Q', page: 1 })
    expect(createEnjoyListQuery({ contentTypeId: 15 })).toEqual({ contentTypeId: 15, arrange: 'Q', page: 1 })
  })

  it('유형이 없으면 null', () => {
    expect(createEnjoyListQuery({})).toBeNull()
    expect(createEnjoyListQuery({ contentTypeId: null })).toBeNull()
  })
})

describe('serializeEnjoyListQuery', () => {
  it('기본값(arrange=Q, page=1)은 URL에 남기지 않는다', () => {
    expect(serializeEnjoyListQuery({ contentTypeId: 39, arrange: 'Q', page: 1 }).toString()).toBe('contentTypeId=39')
  })

  it('기본이 아닌 값은 정해진 순서(contentTypeId, arrange, page)로 쓴다', () => {
    expect(serializeEnjoyListQuery({ contentTypeId: 38, arrange: 'O', page: 2 }).toString())
      .toBe('contentTypeId=38&arrange=O&page=2')
  })

  it('query가 없거나 유효하지 않으면 빈 쿼리', () => {
    expect(serializeEnjoyListQuery(null).toString()).toBe('')
    expect(serializeEnjoyListQuery({ contentTypeId: 12 }).toString()).toBe('')
  })

  it('serialize → parse 왕복이 같은 query를 돌려준다', () => {
    const query = { contentTypeId: 32, arrange: 'O', page: 4 }
    expect(parseEnjoyListQuery(serializeEnjoyListQuery(query).toString())).toEqual(query)
  })
})

describe('applyEnjoyQueryPatch', () => {
  const base = { contentTypeId: 15, arrange: 'Q', page: 3 }

  it('유형이 바뀌면 page를 1로 되돌린다', () => {
    expect(applyEnjoyQueryPatch(base, { contentTypeId: 39 })).toEqual({ contentTypeId: 39, arrange: 'Q', page: 1 })
  })

  it('정렬이 바뀌면 page를 1로 되돌린다', () => {
    expect(applyEnjoyQueryPatch(base, { arrange: 'O' }).page).toBe(1)
  })

  it('같은 값을 다시 넣으면 필터가 바뀐 것이 아니므로 page를 유지한다', () => {
    expect(applyEnjoyQueryPatch(base, { contentTypeId: 15, arrange: 'Q' }).page).toBe(3)
  })

  it('page만 바꾸면 그 값만 바뀐다', () => {
    expect(applyEnjoyQueryPatch(base, { page: 5 })).toEqual({ contentTypeId: 15, arrange: 'Q', page: 5 })
  })

  it('유형을 빈 값으로 지우면 query가 null이 된다', () => {
    expect(applyEnjoyQueryPatch(base, { contentTypeId: '' })).toBeNull()
  })

  it('허용되지 않은 유형 patch는 정규화 결과 null', () => {
    expect(applyEnjoyQueryPatch(base, { contentTypeId: 12 })).toBeNull()
  })

  it('기준 query가 null이면 null', () => {
    expect(applyEnjoyQueryPatch(null, { page: 2 })).toBeNull()
  })
})

describe('toEnjoyApiParams', () => {
  it('기본 크기(9)와 기본 정렬로 요청 파라미터를 만든다', () => {
    expect(toEnjoyApiParams({ contentTypeId: 28, arrange: 'Q', page: 2 }).toString())
      .toBe('page=2&size=9&contentTypeId=28&arrange=Q')
    expect(ENJOY_LIST_PAGE_SIZE).toBe(9)
  })

  it('미리보기처럼 size를 줄일 수 있다', () => {
    expect(toEnjoyApiParams({ contentTypeId: 15, arrange: 'Q', page: 1 }, { size: 3 }).get('size')).toBe('3')
  })

  it('query가 null이면 오류를 던진다', () => {
    expect(() => toEnjoyApiParams(null)).toThrow('즐길거리 목록 조건이 올바르지 않습니다.')
  })
})

describe('buildEnjoySearchPath', () => {
  it('유형이 있으면 조건이 붙은 검색 경로를 만든다', () => {
    expect(buildEnjoySearchPath({ contentTypeId: '15' })).toBe('/enjoy/search?contentTypeId=15')
  })

  it('query가 없으면 조건 없는 검색 경로', () => {
    expect(buildEnjoySearchPath(null)).toBe('/enjoy/search')
  })
})

describe('getEnjoyTypeLabel', () => {
  it('알려진 유형은 이름을, 모르는 유형은 일반 명칭을 돌려준다', () => {
    expect(getEnjoyTypeLabel(15)).toBe('축제 · 행사')
    expect(getEnjoyTypeLabel('39')).toBe('음식점')
    expect(getEnjoyTypeLabel(12)).toBe('즐길거리')
    expect(getEnjoyTypeLabel(undefined)).toBe('즐길거리')
  })
})
