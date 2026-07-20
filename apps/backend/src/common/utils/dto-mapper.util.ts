/**
 * DTO 매핑 유틸리티
 * 엔티티를 DTO로 변환할 때 쓰는 공통 헬퍼를 제공한다.
 *
 * 여기에는 공통 기능만 두고, 도메인별 매퍼(예: ContainerMapper, UserMapper)는
 * 각 도메인에서 따로 만든다.
 */
export class DtoMapper {
  /**
   * 객체에서 지정한 키를 제외한다.
   * 비밀번호처럼 민감한 필드를 응답에서 걷어낼 때 쓴다.
   *
   * @param obj 원본 객체
   * @param keys 제외할 키 목록
   * @returns 해당 키가 빠진 새 객체
   */
  static exclude<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
  }

  /**
   * 객체에서 지정한 키만 골라낸다.
   * @param obj 원본 객체
   * @param keys 포함할 키 목록
   * @returns 해당 키만 담은 새 객체
   */
  static pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      result[key] = obj[key];
    });
    return result;
  }

  /**
   * 엔티티 배열을 DTO 배열로 변환한다.
   * @param entities 엔티티 배열
   * @param mapperFn 변환 함수
   * @returns DTO 배열
   */
  static mapArray<TEntity, TDto>(
    entities: TEntity[],
    mapperFn: (entity: TEntity) => TDto,
  ): TDto[] {
    return entities.map(mapperFn);
  }

  /**
   * Date를 ISO 문자열로 변환한다. (JSON 직렬화에 안전한 형태)
   * @param date Date 객체 또는 문자열
   * @returns ISO 문자열, 값이 없으면 null
   */
  static toISOString(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
  }
}
