import StartUpHelper from '../startUpHelper';
import RoleService from '../../services/RoleService';
import models from '../../database/models';

const { User } = models;

describe('Super Admin test', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should test createSuperAdmin successfully', async () => {
    const UserFindOrCreateMock = jest.spyOn(User, 'findOrCreate');
    UserFindOrCreateMock.mockResolvedValue([{ addRoles: () => {} }]);

    const RoleFindOrCreateMock = jest.spyOn(RoleService, 'createOrFindRole');
    RoleFindOrCreateMock.mockResolvedValue(['Basic']);

    await StartUpHelper.ensureSuperAdminExists();
    expect(UserFindOrCreateMock).toHaveBeenCalledTimes(2);
    expect(RoleFindOrCreateMock).toHaveBeenCalledTimes(1);
  });

  it('should test getUserNameFromEmail successfully with single name in email', () => {
    const email = 'tembea@gmail.com';
    const userName = StartUpHelper.getUserNameFromEmail(email);
    expect(userName).toEqual('Tembea');
  });

  it('should test getUserNameFromEmail successfully with both names in email', () => {
    const email = 'tembea.devs@gmail.com';
    const userName = StartUpHelper.getUserNameFromEmail(email);
    expect(userName).toEqual('Tembea Devs');
  });

  it('should test createSuperAdmin and throw an error', async () => {
    const mockErr = new Error('boo');
    const UserFindOrCreateMock = jest.spyOn(User, 'findOrCreate').mockRejectedValue(mockErr);

    const RoleFindOrCreateMock = jest.spyOn(RoleService, 'createOrFindRole');
    RoleFindOrCreateMock.mockResolvedValue(['Basic']);

    try {
      await StartUpHelper.ensureSuperAdminExists();
    } catch (error) {
      expect(error).toEqual(mockErr);
    }
    expect(UserFindOrCreateMock).toHaveBeenCalledTimes(2);
    expect(RoleFindOrCreateMock).toHaveBeenCalledTimes(0);
  });
});
