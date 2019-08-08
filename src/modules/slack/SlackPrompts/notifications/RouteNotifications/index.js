import SlackNotifications from '../../Notifications';
import TeamDetailsService from '../../../../../services/TeamDetailsService';
import BugsnagHelper from '../../../../../helpers/bugsnagHelper';
import UserService from '../../../../../services/UserService';
import RouteService from '../../../../../services/RouteService';
import {
  SlackAttachmentField, SlackAttachment, SlackButtonAction
} from '../../../SlackModels/SlackMessageModels';
import RemoveDataValues from '../../../../../helpers/removeDataValues';
import { bugsnagHelper } from '../../../RouteManagement/rootFile';
import RouteServiceHelper from '../../../../../helpers/RouteServiceHelper';
import ProviderAttachmentHelper from '../ProviderNotifications/helper';

export default class RouteNotifications {
  static async sendRouteNotificationToRouteRiders(teamUrl, routeInfo) {
    const {
      riders, route: { destination: { address } }, status, deleted
    } = routeInfo;
    const { botToken: teamBotOauthToken } = await TeamDetailsService.getTeamDetailsByTeamUrl(teamUrl);
    const isDeactivation = (status && status.toLowerCase() === 'inactive') || deleted;
    const details = await RouteService.getRouteBatchByPk(routeInfo.id);
    const updatedDetails = details && await RouteServiceHelper.serializeRouteBatch(details);
    const text = isDeactivation
      ? `Sorry, Your route to *${address}* is no longer available :disappointed:`
      : `Your route to *${address}* has been updated.`;

    const message = await SlackNotifications.createDirectMessage(
      '',
      text,
      !isDeactivation && RouteNotifications.generateRouteUpdateAttachement(updatedDetails)
    );
    RouteNotifications.nofityRouteUsers(riders, message, isDeactivation, teamBotOauthToken);
  }

  static generateRouteUpdateAttachement(updatedDetails) {
    const {
      takeOff, name, destination, driverName, driverPhoneNo
    } = updatedDetails;
    const updateMessageAttachment = new SlackAttachment('Updated Route Details');
    updateMessageAttachment.addOptionalProps('', '', '#3c58d7');
    updateMessageAttachment.addFieldsOrActions('fields', [
      new SlackAttachmentField('Take Off Time', takeOff, true),
      new SlackAttachmentField('Route Name', name, true),
      new SlackAttachmentField('Destination', destination, true),
      new SlackAttachmentField('Driver\'s name', driverName, true),
      new SlackAttachmentField('Driver\'s Phone Number', driverPhoneNo, true),
    ]);
    return updateMessageAttachment;
  }

  static async nofityRouteUsers(riders, message, isDeactivation = false, botToken) {
    try {
      riders.forEach(async (rider) => {
        if (isDeactivation) {
          const theRider = await UserService.getUserById(rider.id);
          theRider.routeBatchId = null;
          await theRider.save();
        }
        RouteNotifications.sendNotificationToRider(message, rider.slackId, botToken);
      });
    } catch (err) {
      BugsnagHelper.log(err);
    }
  }

  static async sendNotificationToRider(message, slackId, slackBotOauthToken) {
    const imId = await SlackNotifications.getDMChannelId(slackId, slackBotOauthToken);
    const response = { ...message, channel: imId };
    await SlackNotifications.sendNotification(response, slackBotOauthToken);
  }

  static async sendRouteUseConfirmationNotificationToRider(data, slackBotOauthToken) {
    try {
      const channelID = await SlackNotifications.getDMChannelId(data.rider.slackId, slackBotOauthToken);

      const actions = [
        new SlackButtonAction('taken', 'Yes', `${data.recordId}`),
        new SlackButtonAction('still_on_trip', 'Still on trip', `${data.recordId}`),
        new SlackButtonAction('not_taken', 'No', `${data.recordId}`, 'danger')];
      const attachment = new SlackAttachment('', '', '', '', '');
      const routeBatch = RemoveDataValues.removeDataValues(await RouteService.getRouteBatchByPk(data.recordId));
      const fields = [
        new SlackAttachmentField('Batch', routeBatch.batch, true),
        new SlackAttachmentField('Took Off At', routeBatch.takeOff, true),
        new SlackAttachmentField('Cab Reg No', routeBatch.cabDetails.regNumber, true),
        new SlackAttachmentField('Driver Name', routeBatch.cabDetails.driverName, true),
        new SlackAttachmentField('Driver Phone Number', routeBatch.cabDetails.driverPhoneNo, true)];
      attachment.addFieldsOrActions('actions', actions);
      attachment.addFieldsOrActions('fields', fields);
      attachment.addOptionalProps('confirm_route_use');
      const message = SlackNotifications.createDirectMessage(channelID, `Hi! <@${data.rider.slackId}> Did you take the trip for route ${routeBatch.route.name}?`, attachment);
      return SlackNotifications.sendNotification(message, slackBotOauthToken);
    } catch (error) {
      bugsnagHelper.log(error);
    }
  }

  /**
      * Sends notification to the manager
      * when a fellow request for a new route have been approved.
      * @return {Promise<*>}
      * @param routeRequest
      * @param slackBotOauthToken
      * @param submission
      */
  static async sendRouteApproveMessageToManager(
    routeRequest, slackBotOauthToken, requestData
  ) {
    try {
      const channelID = await SlackNotifications.getDMChannelId(
        routeRequest.manager.slackId, slackBotOauthToken
      );
      const message = await ProviderAttachmentHelper.getManagerApproveAttachment(
        routeRequest, channelID, true, requestData
      );
      return SlackNotifications.sendNotification(message, slackBotOauthToken);
    } catch (error) {
      BugsnagHelper.log(error);
    }
  }

  /**
        * This function sends a notification to the fellow
        * when the providers team approves the route request
        * @return {Promise<*>}
        * @param routeRequest
        * @param slackBotOauthToken
        * @param submission
        * @param teamUrl
        */
  static async sendRouteApproveMessageToFellow(
    routeRequest, slackBotOauthToken, requestData
  ) {
    try {
      const { fellow } = routeRequest.engagement;
      const channelID = await SlackNotifications.getDMChannelId(
        fellow.slackId, slackBotOauthToken
      );
      const message = await ProviderAttachmentHelper.getFellowApproveAttachment(
        routeRequest, channelID, requestData
      );
      return SlackNotifications.sendNotification(message, slackBotOauthToken);
    } catch (error) {
      BugsnagHelper.log(error);
    }
  }

  static async getReminderMessage(channelID, payload) {
    const reminderAttachment = new SlackAttachment('*Trip Reminder*');
    const routeInfoFields = [
      new SlackAttachmentField('Route Name', payload.routeName, true),
      new SlackAttachmentField('Take Off Time', payload.takeOffTime, true)
    ];
    reminderAttachment.addFieldsOrActions('fields', routeInfoFields);
    return SlackNotifications.createDirectMessage(
      channelID,
      `Hey, <@${payload.rider.slackId}, this is a reminder of your upcoming trip`,

    );
  }

  static async sendRouteTripReminder(data, slackBotOauthToken) {
    try {
      const channelID = await SlackNotifications.getDMChannelId(
        data.rider.slackId, slackBotOauthToken
      );
      const message = await RouteNotifications.getReminderMessage(channelID, data);

      return SlackNotifications.sendNotification(message, slackBotOauthToken);
    } catch (error) {
      bugsnagHelper.log(error);
    }
  }
}
