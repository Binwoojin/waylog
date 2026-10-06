import { describe, expect, it } from 'vitest'
import {
  COURSE_LIST_PAGE_SIZE,
  applyCourseQueryPatch,
  buildCourseListPath,
  createCourseListQuery,
  parseCourseListQuery,
  serializeCourseListQuery,
} from '../../lib/courseListQuery'

describe('parseCourseListQuery', () => {
  it('keyword와 page를 읽는다', () => {
    expect(parseCourseListQuery('?keyword=제주&page=2')).toEqual({ keyword: '제주', page: 2 })
  })

  it('URL이 비어 있어도 항상 유효한 query를 돌려준다(전체 목록)', () => {
    expect(parseCourseListQuery('')).toEqual({ keyword: '', page: 1 })
    expect(parseCourseListQuery(undefined)).toEqual({ keyword: '', page: 1 })
  })

  it('keyword 앞뒤 공백을 자르고, 공백만 있으면 빈 값', () => {
    expect(parseCourseListQuery({ keyword: '  부산 야경  ', page: '1' }).keyword).toBe('부산 야경')
    expect(parseCourseListQuery({ keyword: '   ', page: '1' }).keyword).toBe('')
  })

  it('keyword는 255자까지만 쓴다', () => {
    const long = 'a'.repeat(300)
    expect(parseCourseListQuery({ keyword: long }).keyword).toHaveLength(255)
  })

  it.each(['0', '-2', '2.5', '1e2', '10000', 'third', ''])('잘못된 page(%s)는 1', page => {
    expect(parseCourseListQuery({ keyword: 'x', page }).page).toBe(1)
  })

  it('URLSearchParams 객체를 받는다', () => {
    expect(parseCourseListQuery(new URLSearchParams('keyword=ulleung&page=4'))).toEqual({ keyword: 'ulleung', page: 4 })
  })
})

describe('createCourseListQuery', () => {
  it('필드 객체를 정규화한다', () => {
    expect(createCourseListQuery({ keyword: ' 강릉 ' })).toEqual({ keyword: '강릉', page: 1 })
    expect(createCourseListQuery()).toEqual({ keyword: '', page: 1 })
  })
})

describe('serializeCourseListQuery', () => {
  it('keyword가 없고 page가 1이면 빈 쿼리', () => {
    expect(serializeCourseListQuery({ keyword: '', page: 1 }).toString()).toBe('')
  })

  it('keyword와 page 2 이상만 쓴다', () => {
    expect(serializeCourseListQuery({ keyword: '제주', page: 3 }).toString()).toBe('keyword=%EC%A0%9C%EC%A3%BC&page=3')
  })

  it('query가 없으면 빈 쿼리', () => {
    expect(serializeCourseListQuery(null).toString()).toBe('')
  })

  it('serialize → parse 왕복이 같은 query를 돌려준다', () => {
    const query = { keyword: '해변 드라이브', page: 2 }
    expect(parseCourseListQuery(serializeCourseListQuery(query).toString())).toEqual(query)
  })
})

describe('applyCourseQueryPatch', () => {
  const base = { keyword: '제주', page: 3 }

  it('검색어가 바뀌면 page를 1로 되돌린다', () => {
    expect(applyCourseQueryPatch(base, { keyword: '부산' })).toEqual({ keyword: '부산', page: 1 })
  })

  it('검색어를 공백으로만 바꾸면 빈 검색어가 되고 page를 1로 되돌린다', () => {
    expect(applyCourseQueryPatch(base, { keyword: '   ' })).toEqual({ keyword: '', page: 1 })
  })

  it('page만 바꾸면 검색어는 그대로 둔다', () => {
    expect(applyCourseQueryPatch(base, { page: 5 })).toEqual({ keyword: '제주', page: 5 })
  })

  it('검색어가 같으면 page를 되돌리지 않는다', () => {
    expect(applyCourseQueryPatch(base, { keyword: '제주' }).page).toBe(3)
  })

  it('검색어가 같은 상태에서 page를 함께 넣으면 그 page를 적용한다', () => {
    expect(applyCourseQueryPatch(base, { keyword: '제주', page: 4 })).toEqual({ keyword: '제주', page: 4 })
  })

  it('query가 null이면 기본 query(전체 목록)에서 시작한다', () => {
    expect(applyCourseQueryPatch(null, { keyword: '강원' })).toEqual({ keyword: '강원', page: 1 })
  })

  it('기준 query를 바꾸지 않는다', () => {
    applyCourseQueryPatch(base, { keyword: '부산' })
    expect(base).toEqual({ keyword: '제주', page: 3 })
  })
})

describe('buildCourseListPath', () => {
  it('조건이 있으면 쿼리를 붙이고, 없으면 기본 경로', () => {
    expect(buildCourseListPath({ keyword: '', page: 1 })).toBe('/destinations/courses')
    expect(buildCourseListPath({ keyword: 'ulleung', page: 1 })).toBe('/destinations/courses?keyword=ulleung')
  })

  it('페이지 크기는 9', () => {
    expect(COURSE_LIST_PAGE_SIZE).toBe(9)
  })
})
