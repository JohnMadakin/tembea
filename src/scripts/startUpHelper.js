import bugsnagHelper from '../helpers/bugsnagHelper';
import database from '../database';
import RoleService from '../services/RoleService';
import cache from '../cache';
import RouteEventHandlers from '../modules/events/route-event.handlers';

const { models: { User } } = database;

class StartUpHelper {
  static async ensureSuperAdminExists() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const slackId = process.env.SUPER_ADMIN_SLACK_ID;
    const userName = StartUpHelper.getUserNameFromEmail(email);
    const {
      APPRENTICESHIP_SUPER_ADMIN_EMAIL: email2,
      APPRENTICESHIP_SUPER_ADMIN_SLACK_ID: slackId2
    } = process.env;

    try {
      const user1Promise = User.findOrCreate({
        where: { email },
        defaults: { slackId, name: userName }
      });

      const user2Promise = User.findOrCreate({
        where: { email: email2 },
        defaults: { slackId: slackId2, name: StartUpHelper.getUserNameFromEmail(email2) }
      });

      const [[user], [user2]] = await Promise.all([user1Promise, user2Promise]);
      const [role] = await RoleService.createOrFindRole('Super Admin');
      await Promise.all([RoleService.findOrCreateUserRole(user.id, role.id, user.homebaseId),
        RoleService.findOrCreateUserRole(user2.id, role.id, user2.homebaseId)]);
      return;
    } catch (error) {
      bugsnagHelper.log(error);
    }
  }

  static async flushStaleCache() {
    cache.flush();
  }

  static getUserNameFromEmail(email) {
    let firstName;

    [firstName] = email.split('@');
    const getIndex = firstName.indexOf('.');
    if (getIndex === -1) {
      return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
    const fullName = email.split('@')[0].split('.');
    [firstName] = fullName;
    const firstNameCapitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    const lastName = fullName[fullName.length - 1];
    const lastNameCapitalized = lastName.charAt(0).toUpperCase() + lastName.slice(1);
    return (`${firstNameCapitalized} ${lastNameCapitalized}`);
  }

  static registerEventHandlers() {
    RouteEventHandlers.init();
  }
}

export default StartUpHelper;
