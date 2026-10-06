import { describe, expect, it } from 'vitest'
import {
  LIST_PAGE_SIZE,
  applyQueryPatch,
  buildSearchResultsPath,
  createTourListQuery,
  parseTourListQuery,
  serializeTourListQuery,
  toTourApiParams,
} from '../../lib/tourListQuery'

describe('parseTourListQuery - 검색 결과 모드(URL이 contentTypeId를 가짐)', () => {
  it('모든 조건이 있는 URL을 정규화된 query로 읽는다', () => {
    expect(parseTourListQuery('?contentTypeId=12&lDongRegnCd=11&lDongSignguCd=11680&lclsSystm1=NA&arrange=O&page=2'))
      .toEqual({
        contentTypeId: 12,
        lDongRegnCd: '11',
        lDongSignguCd: '11680',
        category: 'NA',
        arrange: 'O',
        page: 2,
      })
  })

  it('contentTypeId가 없거나 허용값이 아니면 null', () => {
    expect(parseTourListQuery('?lDongRegnCd=11')).toBeNull()
    expect(parseTourListQuery('?contentTypeId=15')).toBeNull()
    expect(parseTourListQuery('?contentTypeId=abc')).toBeNull()
  })

  it('숫자 표기가 다른 유형 값(0xc, 12.0)은 허용하지 않는다', () => {
    expect(parseTourListQuery('?contentTypeId=0xc')).toBeNull()
    expect(parseTourListQuery('?contentTypeId=12.0')).toBeNull()
  })

  it('허용되지 않은 정렬 값은 기본값 Q', () => {
    expect(parseTourListQuery('?contentTypeId=12&arrange=DESC').arrange).toBe('Q')
  })

  it('예전 형식 파라미터(region, type)는 읽지 않는다', () => {
    const query = parseTourListQuery('?contentTypeId=12&region=11&type=NA')
    expect(query.lDongRegnCd).toBeNull()
    expect(query.category).toBeNull()
  })
})

describe('parseTourListQuery - 카탈로그 모드(라우트가 유형을 정함)', () => {
  it('라우트의 contentTypeId와 유형별 분류 파라미터 이름(문화시설은 lclsSystm2)을 쓴다', () => {
    expect(parseTourListQuery('?lclsSystm2=VE07', { contentTypeId: 14 })).toEqual({
      contentTypeId: 14,
      lDongRegnCd: null,
      lDongSignguCd: null,
      category: 'VE07',
      arrange: 'Q',
      page: 1,
    })
  })

  it('문화시설에서 관광지용 lclsSystm1 값은 무시한다', () => {
    expect(parseTourListQuery('?lclsSystm1=VE07', { contentTypeId: 14 }).category).toBeNull()
  })

  it('관광지 분류에 없는 코드(문화시설 코드 VE07)는 버린다', () => {
    expect(parseTourListQuery('?lclsSystm1=VE07', { contentTypeId: 12 }).category).toBeNull()
  })

  it('라우트 유형이 허용값이 아니면 null', () => {
    expect(parseTourListQuery('?lclsSystm1=NA', { contentTypeId: 15 })).toBeNull()
  })
})

describe('정규화 규칙', () => {
  it('시·도 코드는 2~5자리 숫자만 허용한다(세종 36110은 5자리)', () => {
    expect(parseTourListQuery('?contentTypeId=12&lDongRegnCd=36110').lDongRegnCd).toBe('36110')
    expect(parseTourListQuery('?contentTypeId=12&lDongRegnCd=1').lDongRegnCd).toBeNull()
    expect(parseTourListQuery('?contentTypeId=12&lDongRegnCd=123456').lDongRegnCd).toBeNull()
    expect(parseTourListQuery('?contentTypeId=12&lDongRegnCd=seoul').lDongRegnCd).toBeNull()
  })

  it('시군구만 있고 시·도가 없으면 버린다(백엔드가 400으로 거절하는 조합)', () => {
    const query = parseTourListQuery('?contentTypeId=12&lDongSignguCd=11680')
    expect(query.lDongRegnCd).toBeNull()
    expect(query.lDongSignguCd).toBeNull()
  })

  it('시군구 코드가 숫자가 아니면 버린다', () => {
    expect(parseTourListQuery('?contentTypeId=12&lDongRegnCd=11&lDongSignguCd=gangnam').lDongSignguCd).toBeNull()
  })

  it.each(['0', '01', '-1', '1.5', '1e3', '10000', 'abc', ''])('잘못된 page(%s)는 1', page => {
    expect(parseTourListQuery({ contentTypeId: '12', page }).page).toBe(1)
  })

  it('형식에 맞는 page 9999는 그대로 둔다', () => {
    expect(parseTourListQuery('?contentTypeId=12&page=9999').page).toBe(9999)
  })

  it('같은 키가 여러 번 오면 첫 값만 쓴다', () => {
    expect(parseTourListQuery('?contentTypeId=12&page=2&page=5').page).toBe(2)
  })
})

describe('createTourListQuery', () => {
  it('빈 문자열 필드는 선택 안 함으로 보고 null/기본값이 된다', () => {
    expect(createTourListQuery({ contentTypeId: 12, lDongRegnCd: '', category: '', arrange: '' })).toEqual({
      contentTypeId: 12,
      lDongRegnCd: null,
      lDongSignguCd: null,
      category: null,
      arrange: 'Q',
      page: 1,
    })
  })

  it('유형이 없으면 null', () => {
    expect(createTourListQuery({ lDongRegnCd: '11' })).toBeNull()
  })
})

describe('serializeTourListQuery', () => {
  it('기본값(arrange=Q, page=1)과 빈 조건은 URL에 남기지 않는다', () => {
    const query = createTourListQuery({ contentTypeId: 12 })
    expect(serializeTourListQuery(query).toString()).toBe('contentTypeId=12')
  })

  it('정해진 순서로 쓰고, 시군구는 시·도가 있을 때만 쓴다', () => {
    const query = createTourListQuery({
      contentTypeId: 12,
      lDongRegnCd: '11',
      lDongSignguCd: '11680',
      category: 'NA',
      arrange: 'O',
      page: 3,
    })
    expect(serializeTourListQuery(query).toString())
      .toBe('contentTypeId=12&lDongRegnCd=11&lDongSignguCd=11680&lclsSystm1=NA&arrange=O&page=3')
  })

  it('includeContentType: false이면 카탈로그 URL처럼 contentTypeId를 뺀다', () => {
    const query = createTourListQuery({ contentTypeId: 14, category: 'VE06' })
    expect(serializeTourListQuery(query, { includeContentType: false }).toString()).toBe('lclsSystm2=VE06')
  })

  it('query가 없으면 빈 쿼리', () => {
    expect(serializeTourListQuery(null).toString()).toBe('')
  })

  it('serialize → parse 왕복이 같은 query를 돌려준다', () => {
    const query = createTourListQuery({ contentTypeId: 14, lDongRegnCd: '26', category: 'VE08', page: 4 })
    expect(parseTourListQuery(serializeTourListQuery(query).toString())).toEqual(query)
  })
})

describe('applyQueryPatch', () => {
  const base = createTourListQuery({
    contentTypeId: 12,
    lDongRegnCd: '11',
    lDongSignguCd: '11680',
    category: 'NA',
    arrange: 'O',
    page: 3,
  })

  it('필터가 바뀌면 page를 1로 되돌린다', () => {
    expect(applyQueryPatch(base, { category: 'HS' }).page).toBe(1)
    expect(applyQueryPatch(base, { arrange: 'Q' }).page).toBe(1)
  })

  it('같은 값을 다시 넣으면 필터가 바뀐 것이 아니므로 page를 유지한다', () => {
    expect(applyQueryPatch(base, { category: 'NA' }).page).toBe(3)
  })

  it('page만 바꾸면 그 값만 바뀐다', () => {
    expect(applyQueryPatch(base, { page: 5 }).page).toBe(5)
  })

  it('시·도가 바뀌면 시군구를 지운다', () => {
    const next = applyQueryPatch(base, { lDongRegnCd: '26' })
    expect(next.lDongRegnCd).toBe('26')
    expect(next.lDongSignguCd).toBeNull()
  })

  it('같은 patch에 시군구가 함께 있으면 그 값을 쓴다', () => {
    const next = applyQueryPatch(base, { lDongRegnCd: '26', lDongSignguCd: '26110' })
    expect(next.lDongSignguCd).toBe('26110')
  })

  it('유형을 바꾸면 새 유형에 없는 분류는 버려진다', () => {
    const next = applyQueryPatch(base, { contentTypeId: 14 })
    expect(next.contentTypeId).toBe(14)
    expect(next.category).toBeNull()
  })

  it('빈 값 patch는 해당 조건을 지운다', () => {
    expect(applyQueryPatch(base, { category: '' }).category).toBeNull()
  })

  it('허용되지 않은 유형 patch는 null', () => {
    expect(applyQueryPatch(base, { contentTypeId: 15 })).toBeNull()
  })

  it('기준 query가 null이면 null', () => {
    expect(applyQueryPatch(null, { page: 2 })).toBeNull()
  })
})

describe('toTourApiParams', () => {
  it('관광지: 대분류를 lclsSystm1으로 보내고 기본 크기와 정렬을 붙인다', () => {
    const params = toTourApiParams(createTourListQuery({ contentTypeId: 12, category: 'NA', page: 2 }))
    expect(params.toString()).toBe('page=2&size=9&contentTypeId=12&lclsSystm1=NA&arrange=Q')
    expect(LIST_PAGE_SIZE).toBe(9)
  })

  it('문화시설: 중분류(lclsSystm2)와 함께 앞 2자리 대분류(lclsSystm1=VE)도 보낸다', () => {
    const params = toTourApiParams(createTourListQuery({ contentTypeId: 14, category: 'VE07' }))
    expect(params.get('lclsSystm1')).toBe('VE')
    expect(params.get('lclsSystm2')).toBe('VE07')
    expect(params.has('lclsSystm1')).toBe(true)
  })

  it('시·도가 없으면 지역 파라미터를 보내지 않고, 시군구만 있는 경우도 보내지 않는다', () => {
    const params = toTourApiParams(createTourListQuery({ contentTypeId: 12 }))
    expect(params.has('lDongRegnCd')).toBe(false)
    expect(params.has('lDongSignguCd')).toBe(false)
  })

  it('지역이 있으면 시·도와 시군구를 함께 보낸다', () => {
    const params = toTourApiParams(createTourListQuery({ contentTypeId: 12, lDongRegnCd: '11', lDongSignguCd: '11680' }))
    expect(params.get('lDongRegnCd')).toBe('11')
    expect(params.get('lDongSignguCd')).toBe('11680')
  })

  it('미리보기처럼 size를 줄일 수 있다', () => {
    expect(toTourApiParams(createTourListQuery({ contentTypeId: 12 }), { size: 3 }).get('size')).toBe('3')
  })

  it('query가 null이거나 유형이 잘못되면 오류를 던진다', () => {
    expect(() => toTourApiParams(null)).toThrow('목록 조건의 여행지 유형이 올바르지 않습니다.')
  })
})

describe('buildSearchResultsPath', () => {
  it('조건이 있으면 검색 결과 경로에 쿼리를 붙인다', () => {
    expect(buildSearchResultsPath({ contentTypeId: 14, category: 'VE06' }))
      .toBe('/destinations/search?contentTypeId=14&lclsSystm2=VE06')
  })

  it('query가 없으면 조건 없는 검색 결과 경로', () => {
    expect(buildSearchResultsPath(null)).toBe('/destinations/search')
  })
})
