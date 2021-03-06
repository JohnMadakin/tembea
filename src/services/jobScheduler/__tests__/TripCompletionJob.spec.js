import schedule from 'node-schedule';
import moment from 'moment';
import tripService from '../../TripService';
import RemoveDataValues from '../../../helpers/removeDataValues';
import TripCompletionJob from '../jobs/TripCompletionJob';
import { trips, trip } from '../__mocks__/TripCompletionMockData';


describe('TripCompletionJob', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe('TripCompletionJob_sendNotificationForConfirmedTrips', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it('should query the database for either confirmed or pending trips', async () => {
      jest.spyOn(tripService, 'getAll').mockResolvedValue(trips);
      jest.spyOn(RemoveDataValues, 'removeDataValues').mockReturnValue(trips);
      jest.spyOn(TripCompletionJob, 'createScheduleForATrip').mockReturnValue();
      await TripCompletionJob.sendNotificationForConfirmedTrips();
      
      expect(tripService.getAll).toBeCalled();
      expect(RemoveDataValues.removeDataValues).toBeCalled();
      expect(TripCompletionJob.createScheduleForATrip).toBeCalledTimes(2);
    });
  });
  describe('TripCompletionJob_calculateNotificationPrompTime', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it('should add 2 hours to the departure time', async () => {
      const dateTime = new Date('2019-3-27T05:30:00');
      const dataTimePlusTwoHours = moment(new Date('2019-3-27T07:30:00')).format();
      const result = await TripCompletionJob
        .calculateNotificationPrompTime(dateTime, 2);

      expect(result).toEqual(dataTimePlusTwoHours);
    });
  });
  describe('TripCompletionJob_createScheduleForATrip', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });
    it('should create a scedule for a trip', async () => {
      jest.spyOn(TripCompletionJob, 'calculateNotificationPrompTime').mockReturnValue(
        '2019-03-27T07:00:21+03:00'
      );
      jest.spyOn(schedule, 'scheduleJob').mockReturnValue();
      await TripCompletionJob.createScheduleForATrip(
        trip, '2019-03-27T05:00:21+0300'
      );
      expect(schedule.scheduleJob).toBeCalled();
    });
  });
});
