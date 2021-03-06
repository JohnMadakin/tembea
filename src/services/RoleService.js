import database from '../database';
import HttpError from '../helpers/errorHandler';
import UserService from './UserService';

const { models: { Role, UserRole, Homebase } } = database;

class RoleService {
  static async createNewRole(name) {
    const [role, created] = await RoleService.createOrFindRole(name);
    if (created) {
      return role;
    }

    HttpError.throwErrorIfNull(false, 'Role already exists', 409);
  }

  static async getRoles() {
    const roles = await Role.findAll();
    HttpError.throwErrorIfNull(roles, 'No Existing Roles');

    return roles;
  }

  static async getUserRoles(email) {
    const user = await UserService.getUser(email);
    const roles = await user.getRoles();

    HttpError.throwErrorIfNull(roles[0], 'User has no role');

    return roles;
  }

  static async getRole(name) {
    const role = await Role.findOne({ where: { name } });
    HttpError.throwErrorIfNull(role, 'Role not found');

    return role;
  }

  static async createUserRole(email, roleName, homebaseId) {
    const [user, role] = await Promise.all([
      UserService.getUser(email),
      RoleService.getRole(roleName)
    ]);

    try {
      await UserRole.create({ userId: user.id, roleId: role.id, homebaseId });
    } catch (e) {
      HttpError.throwErrorIfNull('', 'This Role is already assigned to this user', 409);
    }
    return true;
  }

  static async createOrFindRole(name) {
    const role = await Role.findOrCreate({ where: { name } });
    return role;
  }

  static async findUserRoles(userId) {
    const result = await UserRole.findAll(
      {
        where: { userId },
        include: [{ model: Homebase }, { model: Role }]
      }
    );
    return result;
  }

  static async findOrCreateUserRole(userId, roleId, homebaseId) {
    const result = await UserRole.findOrCreate({ where: { userId, roleId, homebaseId } });
    return result;
  }
}

export default RoleService;
