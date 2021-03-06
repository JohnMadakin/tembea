import AddressService from '../services/AddressService';
import LocationService from '../services/LocationService';
import RouteService, { routeService } from '../services/RouteService';
import { cabService } from '../services/CabService';
import { providerService } from '../services/ProviderService';
import { expectedCreateRouteObject } from '../utils/data';
import RouteRequestService from '../services/RouteRequestService';
import RouteNotifications from '../modules/slack/SlackPrompts/notifications/RouteNotifications';
import ConfirmRouteUseJob from '../services/jobScheduler/jobs/ConfirmRouteUseJob';

export default class RouteHelper {
  static checkRequestProps(createRouteRequest) {
    const receivedProps = Object.keys(createRouteRequest);

    return expectedCreateRouteObject.reduce((acc, item) => {
      if (!receivedProps.includes(item)) {
        acc = `${acc}, ${item}`; // eslint-disable-line no-param-reassign
      }
      return acc;
    }, '');
  }

  static sendTakeOffReminder(rider, batch, botToken) {
    RouteNotifications.sendRouteTripReminder(
      { rider, batch }, botToken
    );
  }

  static sendCompletionNotification(rider, record, botToken) {
    RouteNotifications.sendRouteUseConfirmationNotificationToRider(
      {
        rider, record
      }, botToken
    );
  }

  static findPercentageUsage(record, allUsageRecords, dormantRouteBatches) {
    const usageRecords = Object.values(record);
    const confirmedRecords = usageRecords.filter(
      (confirmed) => confirmed.userAttendStatus === 'Confirmed'
    );
    const batchUsage = {};
    const { RouteBatchName, Route } = record[0];
    batchUsage.Route = Route;
    batchUsage.RouteBatch = RouteBatchName;
    batchUsage.users = usageRecords.length;
    if (!confirmedRecords.length) {
      batchUsage.percentageUsage = 0;
      dormantRouteBatches.push(batchUsage);
      return dormantRouteBatches;
    }
    const percentageUsage = (confirmedRecords.length / usageRecords.length) * 100;
    batchUsage.percentageUsage = Math.round(percentageUsage);
    allUsageRecords.push(batchUsage);
    return allUsageRecords;
  }

  static findMaxOrMin(arrayList, status) {
    const emptyRecord = {
      Route: 'N/A',
      RouteBatch: '',
      users: 0,
      percentageUsage: 0
    };
    return arrayList.reduce((prev, current) => {
      if (status === 'max') {
        return (prev.percentageUsage === current.percentageUsage)
          ? RouteHelper.reducerHelper(prev, current, 'users', 'max')
          : RouteHelper.reducerHelper(prev, current, 'percentageUsage', 'max');
      }
      if (arrayList.length === 1) {
        return emptyRecord;
      }
      return (prev.percentageUsage === current.percentageUsage)
        ? RouteHelper.reducerHelper(prev, current, 'users', 'min')
        : RouteHelper.reducerHelper(prev, current, 'percentageUsage', 'min');
    }, { emptyRecord });
  }

  static reducerHelper(prev, current, attribute, status) {
    if (status === 'min') {
      return prev[attribute] < current[attribute] ? prev : current;
    }
    return prev[attribute] > current[attribute] ? prev : current;
  }

  static checkNumberValues(value, field) {
    const isInter = Number.isInteger(parseInt(value, 10));
    const isGreaterThanZero = parseInt(value, 10) > 0;

    if (isInter && isGreaterThanZero) return [];
    return [`${field} must be a non-zero integer greater than zero`];
  }

  static async checkThatAddressAlreadyExists(address) {
    const existingAddress = await AddressService.findAddress(address);
    return !!existingAddress;
  }

  static async checkThatLocationAlreadyExists(coordinates) {
    let location;
    if (coordinates) {
      const { lat: latitude, lng: longitude } = coordinates;
      location = await LocationService.findLocation(longitude, latitude);
    }
    return !!location;
  }

  static async checkThatVehicleRegNumberExists(vehicleRegNumber) {
    const cab = await cabService.findByRegNumber(vehicleRegNumber);
    return [!!cab, cab];
  }

  static async checkThatRouteNameExists(name) {
    const route = await routeService.getRouteByName(name);
    return [!!route, route];
  }

  static async checkThatProviderIdExists(providerId) {
    const provider = await providerService.getProviderById(providerId);
    return [!!provider];
  }

  static async createNewRouteWithBatch(data) {
    const {
      routeName,
      destination: { address, location, coordinates },
      takeOffTime, capacity, providerId, imageUrl
    } = data;

    const [latitude, longitude] = location
      ? [location.latitude, location.longitude] : [coordinates.lat, coordinates.lng];

    const destinationAddress = await AddressService.createNewAddress(longitude,
      latitude, address);

    const routeObject = {
      name: routeName,
      imageUrl,
      destinationId: destinationAddress.id
    };

    const { route } = await RouteService.createRoute(routeObject);

    const batchData = {
      capacity,
      takeOff: takeOffTime,
      providerId,
      routeId: route.id
    };
    const batch = await routeService.createRouteBatch(batchData, true);
    await ConfirmRouteUseJob.scheduleTakeOffReminders(batch);
    return { route, batch };
  }

  static async createNewRouteBatchFromSlack(submission, routeRequestId) {
    const routeRequest = await RouteRequestService.findByPk(routeRequestId, true);
    const {
      routeName,
      takeOffTime,
      routeCapacity: capacity,
      providerId
    } = submission;

    const {
      routeImageUrl: imageUrl,
      busStop: destination
    } = routeRequest;
    const data = {
      routeName, destination, takeOffTime, capacity, providerId, imageUrl
    };
    return RouteHelper.createNewRouteWithBatch(data);
  }

  static async duplicateRouteBatch(id) {
    const routeBatch = await RouteService.getRouteBatchByPk(id, true);
    if (!routeBatch) {
      return 'Route does not exist';
    }
    const batch = await RouteHelper.cloneBatchDetails(routeBatch);
    return { batch, routeName: routeBatch.route.name };
  }

  static async cloneBatchDetails(routeBatch) {
    const batch = await routeService.createRouteBatch(routeBatch, false);
    return batch;
  }

  static async updateRouteRequest(routeId, data) {
    await RouteRequestService.update(routeId, data);

    const updatedRequest = await RouteRequestService.findByPk(routeId, true);
    return updatedRequest;
  }

  /**
   * @description This validator checks to ensure that the route request status can be modified
   * @param  {Object} req The request object
   * @param  {Object} res The response object
   * @param  {function} next The next middleware
   */
  static validateRouteStatus(routeRequest) {
    const { status } = routeRequest;

    if (status === 'Approved' || status === 'Declined') {
      return `This request has already been ${status.toLowerCase()}`;
    }

    if (status !== 'Confirmed') {
      return 'This request needs to be confirmed by the manager first';
    }

    return true;
  }

  static batchObject(routeBatch, batch) {
    const { takeOff, capacity, status } = routeBatch;
    const data = {
      takeOff,
      capacity,
      status,
      batch
    };
    return data;
  }

  static pageDataObject(result) {
    const pageData = {
      pageMeta: {
        totalPages: result.totalPages,
        page: result.pageNo,
        totalResults: result.totalItems.length,
        pageSize: result.itemsPerPage
      },
      routes: result.routes
    };
    return pageData;
  }
}
