import {
  ButtonElement, CancelButtonElement,
  SlackText, Block, BlockTypes
} from '../models/slack-block-models';
import Validators from '../../../helpers/slack/UserInputValidator/Validators';
import {
  SlackDialogError,
  SlackDialogSelectElementWithOptions,
  SlackDialogText
} from '../../slack/SlackModels/SlackDialogModels';
import { toLabelValuePairs, dateHint } from '../../../helpers/slack/createTripDetailsForm';
import { kampalaPickUpLocations, pickupLocations } from '../../../utils/data';
import WebClientSingleton from '../../../utils/WebClientSingleton';
import Cache from '../../../cache';
import userTripActions from '../trips/user/actions';
import { HOMEBASE_NAMES } from '../../../helpers/constants';


export const sectionDivider = new Block(BlockTypes.divider);
export const defaultKeyValuePairs = { text: 'text', value: 'value' };

export default class NewSlackHelpers {
  static getNavButtons(backValue, backActionId) {
    const navigationButtons = [
      new ButtonElement(new SlackText('< Back'), backValue, backActionId),
      new CancelButtonElement('Cancel', 'cancel', userTripActions.cancel, {
        title: 'Are you sure?',
        description: 'Do you really want to cancel',
        confirmText: 'Yes',
        denyText: 'No'
      })
    ];
    return navigationButtons;
  }

  static getNavBlock(blockId, backActionId, backValue) {
    const navButtons = NewSlackHelpers.getNavButtons(backValue, backActionId);
    const navigation = new Block(BlockTypes.actions, blockId);
    navigation.addElements(navButtons);
    return navigation;
  }

  static dialogValidator(data, schema) {
    try {
      const results = Validators.validateSubmission(data, schema);
      return results;
    } catch (err) {
      const error = new Error('dialog validation failed');
      error.errors = err.errors.details.map((e) => {
        const key = e.path[0];
        return new SlackDialogError(key,
          e.message || 'the submitted property for this value is invalid');
      });
      throw error;
    }
  }

  static hasNeededProps(data, keyPairs) {
    let hasProps = false;
    if (data) {
      const func = Object.prototype.hasOwnProperty;
      hasProps = func.call(data, keyPairs.text) && func.call(data, keyPairs.value);
    }
    return hasProps;
  }

  static toSlackDropdown(data, keyPairs = defaultKeyValuePairs) {
    return data.filter((e) => this.hasNeededProps(e, keyPairs))
      .map((entry) => ({
        text: new SlackText(entry[keyPairs.text].toString()),
        value: entry[keyPairs.value].toString()
      }));
  }

  static async getPickupFields(homeBaseName) {
    const locations = homeBaseName === HOMEBASE_NAMES.NAIROBI ? toLabelValuePairs(pickupLocations)
      : toLabelValuePairs(kampalaPickUpLocations);
    const pickupField = new SlackDialogSelectElementWithOptions('Pickup location',
      'pickup', locations);

    const othersPickupField = new SlackDialogText('Others?',
      'othersPickup', 'Enter pickup location', true);

    const dateField = new SlackDialogText('Date and Time',
      'dateTime', 'dd/mm/yy hh:mm', false, dateHint);

    return [
      dateField,
      pickupField,
      othersPickupField,
    ];
  }

  static async getDestinationFields(homeBaseName) {
    const locations = homeBaseName === HOMEBASE_NAMES.NAIROBI ? toLabelValuePairs(pickupLocations)
      : toLabelValuePairs(kampalaPickUpLocations);
    const destinationField = new SlackDialogSelectElementWithOptions('Destination location',
      'destination', locations);

    const othersDestinationField = new SlackDialogText('Others?',
      'othersDestination', 'Enter destination', true);

    return [
      destinationField,
      othersDestinationField
    ];
  }

  static async getUserInfo(slackId, slackBotOauthToken) {
    const cacheKey = `USER_SLACK_INFO_${slackId}`;
    const result = await Cache.fetch(cacheKey);
    if (result) return result;
    const { user } = await WebClientSingleton.getWebClient(slackBotOauthToken).users.info({
      user: slackId
    });
    await Cache.saveObject(cacheKey, user);

    return user;
  }
}
