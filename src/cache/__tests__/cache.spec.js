import Cache from '../index';
import { LRUCacheSingleton, cacheOptions } from '../lruCache';

describe('Cache tests', () => {
  it('should initialise and save information as an object to the cache for the first time', () => {
    Cache.save('dummyId', 'someField', 'someValue');
    const savedValue = Cache.fetch('dummyId');
    expect(savedValue).toEqual({ someField: 'someValue' });
  });

  it('should update the existing object saved to cache with new information passed', () => {
    const value = Cache.save('dummyId', 'someField', 'someValue');
    expect(value).toEqual(true);
  });
});

describe('Cache Singleton', () => {
  it('should return an existing instance', () => {
    const cacheInstance = new LRUCacheSingleton(cacheOptions(60));
    const anotherInstance = new LRUCacheSingleton(cacheOptions(60));
    expect(cacheInstance).toEqual(anotherInstance);
  });

  it('should update the existing object saved to cache with new information passed', () => {
    const value = Cache.save('dummyId', 'someField', 'someValue');
    expect(value).toEqual(true);
  });
});
