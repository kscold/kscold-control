/**
 * DTO Mapper utility
 * Provides helper methods for mapping entities to DTOs
 *
 * This is a base utility. Specific mappers should be created
 * for each domain (e.g., ContainerMapper, UserMapper)
 */
export class DtoMapper {
  /**
   * Exclude specified keys from an object
   * Useful for removing sensitive fields (e.g., password)
   *
   * @param obj Source object
   * @param keys Keys to exclude
   * @returns New object without excluded keys
   */
  static exclude<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
  }

  /**
   * Pick only specified keys from an object
   * @param obj Source object
   * @param keys Keys to include
   * @returns New object with only specified keys
   */
  static pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      result[key] = obj[key];
    });
    return result;
  }

  /**
   * Map an array of entities to DTOs
   * @param entities Array of entities
   * @param mapperFn Mapper function
   * @returns Array of DTOs
   */
  static mapArray<TEntity, TDto>(
    entities: TEntity[],
    mapperFn: (entity: TEntity) => TDto,
  ): TDto[] {
    return entities.map(mapperFn);
  }

  /**
   * Convert Date to ISO string (safe for JSON serialization)
   * @param date Date object or string
   * @returns ISO string or null
   */
  static toISOString(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
  }
}
