import SlackNotifications from '../../Notifications';
import {
  SlackButtonAction,
  SlackAttachment,
  SlackSelectAction,
} from '../../../SlackModels/SlackMessageModels';
import TeamDetailsService from '../../../../../services/TeamDetailsService';
import UserService from '../../../../../services/UserService';
import ProviderAttachmentHelper from './helper';
import BugsnagHelper from '../../../../../helpers/bugsnagHelper';
import ProviderService from '../../../../../services/ProviderService';
import { driverService } from '../../../../../services/DriverService';
import CabsHelper from '../../../helpers/slackHelpers/CabsHelper';
import { cabService } from '../../../../../services/CabService';
import RemoveDataValues from '../../../../../helpers/removeDataValues';
import RouteService from '../../../../../services/RouteService';
import InteractivePrompts from '../../InteractivePrompts';

/**
 * A class representing provider notification
 *
 * @class ProviderNotifications
 */

export default class ProviderNotifications {
  static checkIsDirectMessage(providerDetails, slackId) {
    if (!providerDetails.isDirectMessage) return providerDetails.channelId;
    return slackId;
  }

  /**
   * @method sendRouteApprovalNotification
   * @description sends a provider a message when they have been assigned a route
   * @param {object} routeBatch
   * @param {object} providerId
   * @param {string} botToken
   */
  static async sendRouteApprovalNotification(routeBatch, providerId, botToken) {
    const provider = await ProviderService.findByPk(providerId, true);
    const batch = RemoveDataValues.removeDataValues(routeBatch);
    const { user: { slackId }, name } = provider;
    const directMessageID = await SlackNotifications.getDMChannelId(slackId, botToken);
    const route = await RouteService.getRouteBatchByPk(batch.routeId, true);
    const channel = await ProviderNotifications.checkIsDirectMessage(provider, slackId);
    const channelID = channel === slackId ? directMessageID : channel;
    const attachment = new SlackAttachment('Assign driver and cab');
    attachment.addFieldsOrActions('fields',
      ProviderAttachmentHelper.providerRouteFields(route));
    attachment.addFieldsOrActions('actions', [
      new SlackButtonAction('provider_approval', 'Accept', `${batch.id}`)
    ]);
    attachment.addOptionalProps('provider_actions_route', '', '#FFCCAA');
    const message = SlackNotifications.createDirectMessage(channelID,
      `A route has been assigned to *${name}*, please assign a cab and a driver`,
      [attachment]);
    return SlackNotifications.sendNotification(message, botToken);
  }

  /**
   * @method updateRouteApprovalNotification
   * @description updates provider notification message
   * @param {string} channel
   * @param {string} botToken
   * @param {string} timeStamp
   * @param {array} attachment
   */
  static async updateRouteApprovalNotification(channel, botToken, timeStamp, attachment) {
    try {
      await InteractivePrompts.messageUpdate(channel,
        'Thank you for assigning a cab and driver. :smiley: *`This is a recurring trip.`*',
        timeStamp,
        [attachment],
        botToken);
    } catch (err) {
      BugsnagHelper.log(err);
    }
  }

  /**
   * Handler for sending notifications to provider
   * It sends a notification to a provider channel
   * if the provider has been marked to receive the
   * notification in a channel, else, it sends the
   * notification to the provider's DM
   *
   * @static
   * @param {number} providerUserSlackId - The unique identifier of the provider's owner
   * @param {string} slackBotOauthToken - Slackbot auth token
   * @param {Object} tripDetails - An object containing the trip detials
   * @returns {Function} HTTP client that makes request to Slack's Web API
   * @memberof ProviderNotifications
   */
  static async sendTripNotification(providerUserSlackId, providerName,
    slackBotOauthToken, tripDetails) {
    const { id: tripId } = tripDetails;
    const directMessageId = await SlackNotifications
      .getDMChannelId(providerUserSlackId, slackBotOauthToken);
    const attachment = new SlackAttachment();
    const fields = SlackNotifications.notificationFields(tripDetails);
    attachment.addFieldsOrActions('actions',
      [new SlackButtonAction('assign-cab', 'Accept', `${tripId}`)]);
    attachment.addFieldsOrActions('fields', fields);
    attachment.addOptionalProps('provider_actions', 'fallback', '#FFCCAA', 'default');
    try {
      const providerUser = await ProviderService.getProviderBySlackId(providerUserSlackId);
      const { isDirectMessage, channelId } = providerUser;
      if (!isDirectMessage) {
        return SlackNotifications.sendNotifications(
          channelId,
          attachment,
          `Hello <@${providerUserSlackId}>\nA trip has been assigned to `
          + `*${providerName}*, please assign a driver and a cab`,
          slackBotOauthToken
        );
      }
      const message = SlackNotifications.createDirectMessage(directMessageId,
        `A trip has been assigned to *${providerName}*,`
        + 'please assign a driver and a cab', [attachment]);

      await SlackNotifications.sendNotification(message, slackBotOauthToken);
    } catch (err) { BugsnagHelper.log(err); }
  }

  /**
   * @method UpdateProviderNotification
   * @description Updates provider notification after assigning a cab and vehicle
   * @param {string} channel
   * @param {string} botToken
   * @param {object} trip
   * @param {string} timeStamp
   * @param {string} driverDetails
   */
  static async UpdateProviderNotification(channel, botToken, trip, timeStamp, driverDetails) {
    try {
      const { provider } = trip;
      const message = `Thank you *${provider.name}* for completing this trip request`;
      const tripDetailsAttachment = new SlackAttachment('Trip request complete');
      tripDetailsAttachment.addOptionalProps('', '', '#3c58d7');
      tripDetailsAttachment.addFieldsOrActions('fields',
        ProviderAttachmentHelper.providerFields(trip, driverDetails));
      await InteractivePrompts.messageUpdate(channel,
        message,
        timeStamp,
        [tripDetailsAttachment],
        botToken);
    } catch (err) {
      BugsnagHelper.log(err);
    }
  }

  static async sendProviderReasignDriverMessage(driver, routes, slackUrl) {
    const { providerId, driverName } = driver;
    const provider = await ProviderService.findByPk(providerId);
    const user = await UserService.getUserById(provider.providerUserId);
    const {
      botToken: teamBotOauthToken
    } = await TeamDetailsService.getTeamDetailsByTeamUrl(slackUrl);
    const where = { providerId: provider.id };
    const { data: drivers } = await driverService.getPaginatedItems(undefined, where);
    const driverData = CabsHelper.toCabDriverValuePairs(drivers, true);
    const directMessageId = await SlackNotifications.getDMChannelId(user.slackId,
      teamBotOauthToken);

    const sendNotifucations = routes.map(route => ProviderNotifications.providerMessagePerRoute(
      route, driverData, directMessageId, driverName, teamBotOauthToken
    ));

    await Promise.all(sendNotifucations);
  }

  static async providerMessagePerRoute(
    route, driverData, directMessageId, driverName, teamBotOauthToken
  ) {
    const { id } = route;
    const attachment = new SlackAttachment('Assign another driver to route');
    const fields = ProviderAttachmentHelper.providerRouteFields(route);

    attachment.addFieldsOrActions('actions', [
      new SlackSelectAction(`${id}`, 'Select Driver', driverData)]);
    attachment.addFieldsOrActions('fields', fields);
    attachment.addOptionalProps('reassign_driver', 'fallback', '#FFCCAA', 'default');

    const message = SlackNotifications.createDirectMessage(directMessageId,
      `Your driver *${driverName}* has been deleted by the Operations team.`
      + ':slightly_frowning_face:',
      [attachment]);
    return SlackNotifications.sendNotification(message, teamBotOauthToken);
  }

  static async updateProviderReasignDriverMessage(channel, botToken, timeStamp, route, driver) {
    const message = 'Driver update complete. Thank you! :smiley:';
    const attachment = new SlackAttachment();
    attachment.addOptionalProps('', '', '#3c58d7');
    const routeFields = ProviderAttachmentHelper.providerRouteFields(route);
    const driverFields = ProviderAttachmentHelper.driverFields(driver);
    attachment.addFieldsOrActions('fields', routeFields);
    attachment.addFieldsOrActions('fields', driverFields);
    try {
      await InteractivePrompts.messageUpdate(channel,
        message,
        timeStamp,
        [attachment],
        botToken);
    } catch (err) {
      BugsnagHelper.log(err);
    }
  }

  static async sendVehicleRemovalProviderNotification(cab, routeBatchData, slackUrl) {
    try {
      const { providerId } = cab;
      const { name: providerName, providerUserId } = await ProviderService
        .findByPk(providerId);
      const { slackId } = await UserService.getUserById(providerUserId);
      const { botToken: slackBotOauthToken } = await TeamDetailsService
        .getTeamDetailsByTeamUrl(slackUrl);
      const channelId = await SlackNotifications.getDMChannelId(slackId, slackBotOauthToken);
      const { data: cabs } = await cabService.getCabs(undefined, { providerId });
      const cabData = CabsHelper.toCabLabelValuePairs(cabs, true);
      const notificationResults = routeBatchData.map((route) => {
        const message = ProviderNotifications.getAssignedNewCabMessage(route,
          { cab, cabData }, providerName, channelId);
        return SlackNotifications.sendNotification(message, slackBotOauthToken);
      });
      await Promise.all(notificationResults);
    } catch (error) {
      BugsnagHelper.log(error);
    }
  }

  static getAssignedNewCabMessage(route, cabOptions, providerName, channelId) {
    const { id } = route;
    const { cab, cabData } = cabOptions;
    const attachment = new SlackAttachment('Please assign another cab');
    attachment.addFieldsOrActions('actions',
      [new SlackSelectAction(`${id}`, 'Select Cab', cabData)]);
    const fields = ProviderAttachmentHelper.providerRouteFields(route);
    attachment.addFieldsOrActions('fields', fields);
    attachment.addOptionalProps('cab_reassign', 'fallback', '#FECCAE', 'default');
    const message = SlackNotifications.createDirectMessage(channelId,
      `Hi *${providerName}*, a vehicle of model *${cab.model}* and a Registration`
      + `Number: *${cab.regNumber}* has been deleted by Andela Operations team.*`,
      attachment);
    return message;
  }

  static async updateProviderReAssignCabMessage(channelId,
    slackBotOauthToken, timestamp, route, cab) {
    const attachment = new SlackAttachment();
    attachment.addOptionalProps('', '', '#CCCEED');
    const routeFields = await ProviderAttachmentHelper.providerRouteFields(route);
    const cabFields = await ProviderAttachmentHelper.cabFields(cab);
    attachment.addFieldsOrActions('fields', routeFields);
    attachment.addFieldsOrActions('fields', cabFields);
    try {
      await InteractivePrompts.messageUpdate(channelId,
        'The Cab has been updated successfully! Thank you! :smiley:',
        timestamp, [attachment], slackBotOauthToken);
    } catch (error) {
      BugsnagHelper.log(error);
    }
  }
}
