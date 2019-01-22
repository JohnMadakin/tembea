import {
  SlackDialogModel,
  SlackDialog,
  SlackDialogText,
  SlackDialogTextarea,
  SlackDialogSelectElementWithOptions
} from '../SlackModels/SlackDialogModels';
import dateDialogHelper from '../../../helpers/dateHelper';
import createDialogForm from '../../../helpers/slack/createDialogForm';
import sendDialogTryCatch from '../../../helpers/sendDialogTryCatch';
import TeamDetailsService from '../../../services/TeamDetailsService';

class DialogPrompts {
  static async sendTripDetailsForm(payload, formElementsFunction, callbackId) {
    const dialogForm = createDialogForm(payload, formElementsFunction, callbackId);

    const slackBotOauthToken = await
    TeamDetailsService.getTeamDetailsBotOauthToken(payload.team.id);
    await sendDialogTryCatch(dialogForm, slackBotOauthToken);
  }

  static async sendRescheduleTripForm(payload, callbackId, state, dialogName) {
    const dialog = new SlackDialog(callbackId || payload.callback_id,
      dialogName, 'submit', true, state);

    dialog.addElements(dateDialogHelper.generateDialogElements());

    const dialogForm = new SlackDialogModel(payload.trigger_id, dialog);
    const slackBotOauthToken = await
    TeamDetailsService.getTeamDetailsBotOauthToken(payload.team.id);
    await sendDialogTryCatch(dialogForm, slackBotOauthToken);
  }

  static async sendTripReasonForm(payload) {
    const dialog = new SlackDialog('schedule_trip_reason',
      'Reason for booking trip', 'Submit');
    const textarea = new SlackDialogTextarea('Reason', 'reason',
      'Enter reason for booking the trip');

    dialog.addElements([textarea]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendDialogToManager(
    payload, callbackId, state, dialogName, submitButtonText, submissionName
  ) {
    const dialog = new SlackDialog(callbackId || payload.callbackId,
      dialogName, submitButtonText, false, state);

    const commentElement = new SlackDialogTextarea('Reason',
      submissionName,
      `Why do you want to ${submitButtonText} this trip`);
    dialog.addElements([commentElement]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendOperationsDeclineDialog(payload) {
    const actionTs = payload.message_ts;
    const { value } = payload.actions[0];
    const state = {
      trip: value,
      actionTs
    };
    const dialog = new SlackDialog('operations_reason_dialog',
      'Reason for declining', 'Submit', false, JSON.stringify(state));
    dialog.addElements([
      new SlackDialogTextarea('Justification', 'opsDeclineComment')
    ]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendOperationsApprovalDialog(payload) {
    const { value } = payload.actions[0];
    const state = { tripId: value, timeStamp: payload.message_ts, channel: payload.channel.id };
    const dialog = new SlackDialog('operations_reason_dialog',
      'Confirm Trip Request', 'Submit', false, JSON.stringify(state));
    dialog.addElements([
      new SlackDialogText('Driver\'s name', 'driverName', 'Enter driver\'s name'),
      new SlackDialogText('Driver\'s contact', 'driverPhoneNo', 'Enter driver\'s contact'),
      new SlackDialogText(
        'Cab Registration number',
        'regNumber',
        'Enter the Cab\'s registration number'
      ),
      new SlackDialogTextarea(
        'Justification',
        'confirmationComment',
        'Reason why',
        'Enter reason for approving trip',
      ),
    ]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendBusStopForm(payload, busStageList) {
    const { value } = payload.actions[0];
    const state = { tripId: value, timeStamp: payload.message_ts, channel: payload.channel.id };

    const dialog = new SlackDialog('new_route_handleBusStopSelected',
      'Drop off', 'Submit', false, JSON.stringify(state));

    const select = new SlackDialogSelectElementWithOptions(
      'Landmarks', 'selectBusStop', busStageList
    );
    select.optional = true;
    if (busStageList.length > 0) { dialog.addElements([select]); }

    dialog.addElements([
      new SlackDialogText('Landmark not listed?',
        'otherBusStop', 'latitude,longitude', true,
        'The location should be in the format (latitude, longitude), eg. -0.234,23.234'),
    ]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendLocationForm(payload, location = 'home') {
    const dialog = new SlackDialog(`new_route_${location}`,
      'Create New Route', 'Submit', true);
    const hint = 'e.g Andela Kenya, Nairobi';
    dialog.addElements([
      new SlackDialogText(`Enter ${location} Address: `,
        'location', `Type in your ${location} address`, false, hint)
    ]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendSkipPage(payload, value) {
    const dialog = new SlackDialog('trip_itinerary',
      'Page to skip to', 'Submit', false, value);
    const textarea = new SlackDialogText('Page Number', 'pageNumber',
      'Page to skip to');

    dialog.addElements([textarea]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendLocationCoordinatesForm(payload) {
    const dialog = new SlackDialog(
      'new_route_suggestions', 'Home address coordinates', 'Submit', true
    );
    const hint = 'e.g -1.219539, 36.886215';
    dialog.addElements([
      new SlackDialogText(
        'Address coordinates:', 'coordinates',
        'Type in your home address latitude and longitude', false, hint
      )]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendEngagementInfoDialogToManager(payload, callback, state, defaultValues = {}) {
    const dialog = new SlackDialog(callback,
      'Fellow\'s Engagement', 'Submit', true, state);
    const sdName = 'startDate';
    const edName = 'endDate';
    const hint = 'hint: dd/mm/yyyy. example: 31/01/2019';
    const sdPlaceholder = 'Start Date';
    const edPlaceholder = 'End Date';
    const startDate = new SlackDialogText(
      `Engagement ${sdPlaceholder}`, sdName, sdPlaceholder, false, hint, defaultValues[sdName]
    );
    const endDate = new SlackDialogText(
      `Engagement ${edPlaceholder}`, edName, edPlaceholder, false, hint, defaultValues[edName]
    );
    dialog.addElements([startDate, endDate]);
    await DialogPrompts.sendDialog(dialog, payload);
  }

  static async sendDialog(dialog, payload) {
    const dialogForm = new SlackDialogModel(payload.trigger_id, dialog);
    const { team: { id: teamId } } = payload;
    const slackBotOauthToken = await TeamDetailsService.getTeamDetailsBotOauthToken(teamId);
    await sendDialogTryCatch(dialogForm, slackBotOauthToken);
  }
}
export default DialogPrompts;
